'use client';

import { api } from "@/utils/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState, useMemo } from "react";
import { Status, TeacherType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

// Type definitions
interface Campus {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
  classGroup: {
    id: string;
    name: string;
    program: {
      id: string;
      name: string;
      campusId: string;
    };
  };
}

interface Subject {
  id: string;
  name: string;
  classGroups: {
    id: string;
    name: string;
  }[];
}

interface ApiError {
  message: string;
}

// Form schema matching the backend expectations
const teacherFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  teacherType: z.nativeEnum(TeacherType),
  specialization: z.string().optional(),
  subjectIds: z.array(z.string()).optional(),
  classIds: z.array(z.string()).optional(),
  campusIds: z.array(z.string()).optional(),
  primaryCampusId: z.string().optional(),
});

type TeacherFormValues = z.infer<typeof teacherFormSchema>;

interface TeacherFormProps {
  initialData?: Partial<TeacherFormValues> & { campusId?: string };
  teacherId?: string;
  isCreate?: boolean;
  onClose?: () => void;
  campusId?: string; // Optional campusId for campus-specific context
}

export default function TeacherForm({
  initialData = {},
  teacherId,
  isCreate,
  onClose,
  campusId,
}: TeacherFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'super-admin';
  const [loading, setLoading] = useState(false);

  // Get all campuses (or single campus if campusId is provided)
  const { data: campuses = [], isLoading: isLoadingCampuses } = api.campus.getAll.useQuery(
    undefined,
    { enabled: !campusId } // Only fetch all campuses if campusId is not provided
  );

  // Get single campus if campusId is provided
  const { data: singleCampus } = api.campus.getById.useQuery(
    campusId!,
    { enabled: !!campusId }
  );

  // Combine campuses based on context
  const availableCampuses = useMemo(() => {
    if (campusId && singleCampus) {
      return [singleCampus];
    }
    return campuses;
  }, [campusId, singleCampus, campuses]);

  // Fix the OR/nullish coalescing operator precedence
  const campusIds = campusId ? [campusId] : (initialData.campusId ? [initialData.campusId] : []);
  
  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      name: initialData.name ?? "",
      email: initialData.email ?? "",
      phoneNumber: initialData.phoneNumber ?? "",
      teacherType: initialData.teacherType ?? TeacherType.SUBJECT,
      specialization: initialData.specialization ?? "",
      subjectIds: initialData.subjectIds ?? [],
      classIds: initialData.classIds ?? [],
      campusIds: campusIds,
      primaryCampusId: (campusId ?? (initialData.campusId ?? "")),
    },
  });

  // Get selected campus IDs
  const selectedCampusIds = form.watch("campusIds") || [];
  const selectedClassIds = form.watch("classIds") || [];

  // Get classes for selected campuses
  const { data: campusClasses = [], isLoading: isLoadingClasses } = api.class.searchClasses.useQuery(
    { campusIds: selectedCampusIds },
    { enabled: selectedCampusIds.length > 0 }
  );

  // Get subjects for selected classes
  const { data: classSubjects = [], isLoading: isLoadingSubjects } = api.subject.searchSubjects.useQuery(
    { 
      classGroupIds: campusClasses
        .filter(c => selectedClassIds.includes(c.id))
        .map(c => c.classGroup.id)
    },
    { enabled: selectedClassIds.length > 0 }
  );

  // Get teacher data if editing
  const { data: teacherData, isLoading: isLoadingTeacher } = api.teacher.getById.useQuery(
    teacherId!,
    { enabled: !!teacherId }
  );

  // Get teacher campuses if editing
  const { data: teacherCampuses = [], isLoading: isLoadingTeacherCampuses } = api.teacher.getTeacherCampuses.useQuery(
    { teacherId: teacherId! },
    { enabled: !!teacherId }
  );

  // Create teacher mutation
  const createTeacher = api.teacher.createTeacher.useMutation({
    onSuccess: (data) => {
      // If campuses are selected, assign them
      if (form.getValues().campusIds?.length) {
        const primaryCampusId = form.getValues().primaryCampusId;
        
        // Assign each campus
        form.getValues().campusIds?.forEach((campusId) => {
          assignTeacherToCampus.mutate({
            teacherId: data.id,
            campusId,
            isPrimary: campusId === primaryCampusId
          });
        });
      }
      
      toast.success("Teacher created successfully");
      setLoading(false);
      router.push(`/dashboard/${role}/teacher`);
      router.refresh();
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
      setLoading(false);
    },
  });

  // Update teacher mutation
  const updateTeacher = api.teacher.updateTeacher.useMutation({
    onSuccess: (data) => {
      // Handle campus assignments if needed
      if (form.getValues().campusIds?.length) {
        const primaryCampusId = form.getValues().primaryCampusId;
        
        // Assign each campus
        form.getValues().campusIds?.forEach((campusId) => {
          // Check if this campus is already assigned
          const existingAssignment = teacherCampuses.find(tc => tc.campusId === campusId);
          
          if (!existingAssignment) {
            assignTeacherToCampus.mutate({
              teacherId: data.id,
              campusId,
              isPrimary: campusId === primaryCampusId
            });
          } else if (existingAssignment.isPrimary !== (campusId === primaryCampusId)) {
            // Update primary status if it changed
            setPrimaryCampus.mutate({
              teacherId: data.id,
              campusId
            });
          }
        });
        
        // Remove campuses that were unselected
        teacherCampuses.forEach(tc => {
          if (!form.getValues().campusIds?.includes(tc.campusId)) {
            removeTeacherFromCampus.mutate({
              teacherId: data.id,
              campusId: tc.campusId
            });
          }
        });
      }
      
      toast.success("Teacher updated successfully");
      setLoading(false);
      router.push(`/dashboard/${role}/teacher`);
      router.refresh();
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
      setLoading(false);
    },
  });

  // Campus assignment mutations
  const assignTeacherToCampus = api.campus.assignTeacherToCampus.useMutation({
    onError: (error) => {
      toast.error(`Failed to assign teacher to campus: ${error.message}`);
    }
  });

  const removeTeacherFromCampus = api.campus.removeTeacherFromCampus.useMutation({
    onError: (error) => {
      toast.error(`Failed to remove teacher from campus: ${error.message}`);
    }
  });

  const setPrimaryCampus = api.campus.setPrimaryCampus.useMutation({
    onError: (error) => {
      toast.error(`Failed to set primary campus: ${error.message}`);
    }
  });

  // Update form when teacher data is loaded
  useEffect(() => {
    if (teacherData && teacherCampuses) {
      const campusIds = campusId ? [campusId] : teacherCampuses.map(tc => tc.campusId);
      const primaryCampus = teacherCampuses.find(tc => tc.isPrimary);
      
      form.reset({
        name: teacherData.name || "",
        email: teacherData.email || "",
        phoneNumber: teacherData.phoneNumber || "",
        teacherType: teacherData.teacherProfile?.teacherType || TeacherType.SUBJECT,
        specialization: teacherData.teacherProfile?.specialization || "",
        subjectIds: teacherData.teacherProfile?.subjects?.map((s: { id: string }) => s.id) ?? [],
        classIds: teacherData.teacherProfile?.classes?.map((c: { id: string }) => c.id) ?? [],
        campusIds: campusIds,
        primaryCampusId: campusId ?? primaryCampus?.campusId || "",
      });
    }
  }, [teacherData, teacherCampuses, form, campusId]);

  const onSubmit = async (data: TeacherFormValues) => {
    try {
      setLoading(true);
      if (isCreate) {
        await createTeacher.mutateAsync({
          ...data,
          teacherType: data.teacherType,
        });
      } else if (teacherId) {
        await updateTeacher.mutateAsync({
          id: teacherId,
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          teacherType: data.teacherType,
          specialization: data.specialization,
          subjectIds: data.subjectIds,
          classIds: data.classIds,
          campusIds: data.campusIds,
          primaryCampusId: data.primaryCampusId,
        });
      }
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(apiError.message || "Something went wrong");
      setLoading(false);
    }
  };

  // Show loading state while fetching teacher data
  if ((teacherId && isLoadingTeacher) || isLoadingTeacherCampuses) {
    return <div>Loading teacher data...</div>;
  }

  // Show error if teacher data failed to load
  if (teacherId && !teacherData && !isLoadingTeacher) {
    return <div>Error loading teacher data. Please try again later.</div>;
  }

  // Fix the type error in the teacher filtering
  const getTeacherDisplayName = (teacherId: string) => {
    const teacher = availableCampuses
      .flatMap(campus => campus.teachers || [])
      .find(t => t && t.id === teacherId);
    return teacher?.user?.name || "Unknown Teacher";
  };

  // Fix the values.includes type error
  const handleCampusChange = (values: string[]) => {
    form.setValue("campusIds", values);
    // Reset dependent fields
    form.setValue("classIds", []);
    form.setValue("subjectIds", []);
    
    // Handle primary campus
    const currentPrimaryCampus = form.getValues().primaryCampusId;
    if (currentPrimaryCampus && !values.includes(currentPrimaryCampus)) {
      form.setValue("primaryCampusId", values[0] || "");
    }
    if ((!currentPrimaryCampus || currentPrimaryCampus === "") && values.length > 0) {
      form.setValue("primaryCampusId", values[0]);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="John Doe" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="john.doe@example.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+1234567890" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teacherType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teacher Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={TeacherType.CLASS}>Class Teacher</SelectItem>
                    <SelectItem value={TeacherType.SUBJECT}>Subject Teacher</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Specialization</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Mathematics, Science" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="classIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Classes</FormLabel>
                <FormControl>
                  <MultiSelect<string>
                    value={field.value ?? []}
                    options={
                      campusClasses?.map((class_) => ({
                        label: `${class_.name} (${class_.classGroup.name})`,
                        value: class_.id,
                      })) ?? []
                    }
                    onChange={(values) => {
                      field.onChange(values);
                      // Reset subjects when classes change
                      form.setValue("subjectIds", []);
                    }}
                    placeholder={selectedCampusIds.length ? "Select classes" : "Please select campus first"}
                    disabled={isLoadingClasses || selectedCampusIds.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subjectIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Subjects</FormLabel>
                <FormControl>
                  <MultiSelect<string>
                    value={field.value ?? []}
                    options={
                      classSubjects?.map((subject) => ({
                        label: subject.name,
                        value: subject.id,
                      })) ?? []
                    }
                    onChange={field.onChange}
                    placeholder={selectedClassIds.length ? "Select subjects" : "Please select classes first"}
                    disabled={isLoadingSubjects || selectedClassIds.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Campus assignments - Only show if not in campus-specific context */}
        {!campusId && (
          <Card>
            <CardHeader>
              <CardTitle>Campus Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="campusIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Campuses</FormLabel>
                      <FormControl>
                        <MultiSelect<string>
                          value={field.value ?? []}
                          options={
                            availableCampuses?.map((campus) => ({
                              label: campus.name,
                              value: campus.id,
                            })) ?? []
                          }
                          onChange={handleCampusChange}
                          placeholder="Select campuses"
                          disabled={isLoadingCampuses}
                        />
                      </FormControl>
                      <FormDescription>
                        Select the campuses where this teacher will be assigned
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryCampusId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Campus</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                        disabled={form.watch("campusIds")?.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select primary campus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {form.watch("campusIds")?.map((campusId) => {
                            const campus = availableCampuses.find((c) => c.id === campusId);
                            return (
                              <SelectItem key={campusId} value={campusId}>
                                {campus?.name || campusId}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The primary campus is where the teacher is primarily based
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? (teacherId ? "Updating..." : "Creating...") : teacherId ? "Update Teacher" : "Create Teacher"}
        </Button>
      </form>
    </Form>
  );
}
