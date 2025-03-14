'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Status } from "@prisma/client";
import { Student } from "@/types/user";
import { useRouter } from "next/navigation";

interface StudentListProps {
	students: Student[];
	onSelect: (id: string) => void;
}

export const StudentList = ({ students, onSelect }: StudentListProps) => {
	const router = useRouter();

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Class</TableHead>
						<TableHead>Program</TableHead>
						<TableHead>Guardian</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{students.length === 0 ? (
						<TableRow>
							<TableCell colSpan={7} className="text-center py-8">
								No students found
							</TableCell>
						</TableRow>
					) : (
						students.map((student) => (
							<TableRow key={student.id}>
								<TableCell className="font-medium">{student.name}</TableCell>
								<TableCell>{student.email}</TableCell>
								<TableCell>
									{student.studentProfile.class ? 
										`${student.studentProfile.class.name} (${student.studentProfile.class.classGroup.name})` : 
										'-'
									}
								</TableCell>
								<TableCell>
									{student.studentProfile.class?.classGroup.program.name || '-'}
								</TableCell>
								<TableCell>
									{student.studentProfile.parent?.user.name || '-'}
								</TableCell>
								<TableCell>
									<Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>
										{student.status}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="flex space-x-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => onSelect(student.id)}
										>
											View Details
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => router.push(`/dashboard/student/edit/${student.id}`)}
										>
											Edit
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
};

