"use client";

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { Card } from '@/components/ui/card';
import { TeacherForm } from '@/components/forms/TeacherForm';
import { useRouter } from 'next/navigation';

interface NewTeacherPageProps {
  params: {
    id: string;
    role: string;
  };
}

export default function NewTeacherPage({ params }: NewTeacherPageProps) {
  const router = useRouter();

  return (
    <DashboardContent>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Add New Teacher</h2>
        <Card className="p-6">
          <TeacherForm
            campusId={params.id}
            onSuccess={() => {
              router.push(`/dashboard/${params.role}/campus/${params.id}/teachers`);
            }}
          />
        </Card>
      </div>
    </DashboardContent>
  );
}
