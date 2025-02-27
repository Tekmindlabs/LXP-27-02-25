"use client";

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Status } from '@prisma/client';
import { Input } from '@/components/ui/input';

interface Teacher {
  id: string;
  name: string;
  email: string;
  status: Status;
  isPrimary: boolean;
  teacherProfile: {
    specialization: string | null;
    teacherType: string | null;
  };
  classCount: number;
  subjectCount: number;
}

export default function TeachersPage({
  params,
}: {
  params: { id: string; role: string };
}) {
  const router = useRouter();
  const { data: teachers, isLoading } = api.campus.getTeachers.useQuery({ campusId: params.id });

  const columns: ColumnDef<Teacher>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'teacherProfile.specialization',
      header: 'Specialization',
    },
    {
      accessorKey: 'teacherProfile.teacherType',
      header: 'Type',
    },
    {
      accessorKey: 'classCount',
      header: 'Classes',
    },
    {
      accessorKey: 'subjectCount',
      header: 'Subjects',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/${params.role}/campus/${params.id}/teachers/${row.original.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/${params.role}/campus/${params.id}/teachers/${row.original.id}/assignments`)}
          >
            View Assignments
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardContent>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold tracking-tight">Teachers</h2>
          <Button onClick={() => router.push(`/dashboard/${params.role}/campus/${params.id}/teachers/new`)}>
            <Plus className="mr-2 h-4 w-4" /> Add Teacher
          </Button>
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <Input
              placeholder="Search teachers..."
              className="max-w-sm"
            />
          </div>

          <DataTable
            columns={columns}
            data={teachers || []}
            isLoading={isLoading}
          />
        </Card>
      </div>
    </DashboardContent>
  );
}