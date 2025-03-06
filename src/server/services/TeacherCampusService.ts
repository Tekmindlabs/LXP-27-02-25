import { PrismaClient, Status, TeacherType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export interface TeacherCampusAssignment {
  teacherId: string;
  campusId: string;
  isPrimary: boolean;
  status?: Status;
}

export interface TeacherClassAssignment {
  teacherCampusId: string;
  classId: string;
  isClassTeacher: boolean;
  subjectIds?: string[];
}

interface SqlResult {
  id: string;
}

interface TeacherCampusResult extends SqlResult {
  campusId: string;
}

export class TeacherCampusService {
  constructor(private prisma: PrismaClient) {}

  async assignTeacherToCampus(data: TeacherCampusAssignment) {
    const { teacherId, campusId, isPrimary, status = Status.ACTIVE } = data;

    // Validate teacher exists
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherId },
      include: { user: true }
    });

    if (!teacher) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Teacher not found"
      });
    }

    // Validate campus exists
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId }
    });

    if (!campus) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campus not found"
      });
    }

    // Check if assignment already exists
    const [existingAssignment] = await this.prisma.$queryRaw<SqlResult[]>`
      SELECT id FROM "TeacherCampus"
      WHERE "teacherId" = ${teacherId} AND "campusId" = ${campusId}
    `;

    if (existingAssignment) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Teacher is already assigned to this campus"
      });
    }

    // If this is primary, unset any existing primary campus
    if (isPrimary) {
      await this.prisma.$executeRaw`
        UPDATE "TeacherCampus"
        SET "isPrimary" = false
        WHERE "teacherId" = ${teacherId} AND "isPrimary" = true
      `;
    }

    // Create the assignment
    const [newAssignment] = await this.prisma.$queryRaw<SqlResult[]>`
      INSERT INTO "TeacherCampus" ("id", "teacherId", "campusId", "isPrimary", "status", "joinedAt", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${teacherId}, ${campusId}, ${isPrimary}, ${status}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, "teacherId", "campusId", "isPrimary", status, "joinedAt"
    `;

    return {
      ...newAssignment,
      teacher: {
        id: teacher.id,
        user: {
          id: teacher.user.id,
          name: teacher.user.name,
          email: teacher.user.email
        }
      },
      campus: {
        id: campus.id,
        name: campus.name
      }
    };
  }

  async assignTeacherToClass(data: TeacherClassAssignment) {
    const { teacherCampusId, classId, isClassTeacher, subjectIds = [] } = data;

    // Validate teacherCampus exists
    const [teacherCampus] = await this.prisma.$queryRaw<TeacherCampusResult[]>`
      SELECT tc.id, tc."teacherId", tc."campusId"
      FROM "TeacherCampus" tc
      WHERE tc.id = ${teacherCampusId}
    `;

    if (!teacherCampus) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Teacher campus assignment not found"
      });
    }

    // Validate class exists and belongs to the same campus
    const class_ = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        classGroup: {
          include: {
            program: true
          }
        }
      }
    });

    if (!class_) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Class not found"
      });
    }

    const classCampusId = class_.classGroup.program.campusId;
    if (classCampusId !== teacherCampus.campusId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Class does not belong to the assigned campus"
      });
    }

    // Create class assignment
    const [classAssignment] = await this.prisma.$queryRaw<SqlResult[]>`
      INSERT INTO "TeacherClassAssignment" ("id", "teacherCampusId", "classId", "isClassTeacher", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${teacherCampusId}, ${classId}, ${isClassTeacher}, ${Status.ACTIVE}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    // Create subject assignments if provided
    if (subjectIds.length > 0) {
      for (const subjectId of subjectIds) {
        await this.prisma.$executeRaw`
          INSERT INTO "TeacherSubjectAssignment" ("id", "teacherClassAssignmentId", "subjectId", "status", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${classAssignment.id}, ${subjectId}, ${Status.ACTIVE}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }
    }

    return {
      id: classAssignment.id,
      teacherCampusId,
      classId,
      isClassTeacher,
      status: Status.ACTIVE,
      class: class_
    };
  }

  async getTeacherCampusAssignments(teacherId: string) {
    const assignments = await this.prisma.$queryRaw<any[]>`
      SELECT 
        tc.id, tc."teacherId", tc."campusId", tc."isPrimary", tc.status,
        c.name as "campusName",
        json_agg(
          json_build_object(
            'id', tca.id,
            'classId', tca."classId",
            'isClassTeacher', tca."isClassTeacher",
            'status', tca.status,
            'subjects', (
              SELECT json_agg(
                json_build_object(
                  'id', s.id,
                  'name', s.name
                )
              )
              FROM "TeacherSubjectAssignment" tsa
              JOIN "Subject" s ON s.id = tsa."subjectId"
              WHERE tsa."teacherClassAssignmentId" = tca.id
            )
          )
        ) as "classAssignments"
      FROM "TeacherCampus" tc
      JOIN "Campus" c ON c.id = tc."campusId"
      LEFT JOIN "TeacherClassAssignment" tca ON tca."teacherCampusId" = tc.id
      WHERE tc."teacherId" = ${teacherId}
      GROUP BY tc.id, tc."teacherId", tc."campusId", tc."isPrimary", tc.status, c.name
    `;

    return assignments;
  }

  async updateAssignmentStatus(teacherCampusId: string, status: Status) {
    const [updated] = await this.prisma.$queryRaw<SqlResult[]>`
      UPDATE "TeacherCampus"
      SET status = ${status}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${teacherCampusId}
      RETURNING id, "teacherId", "campusId", "isPrimary", status
    `;

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Assignment not found"
      });
    }

    return updated;
  }

  async removeTeacherFromCampus(teacherId: string, campusId: string) {
    const [assignment] = await this.prisma.$queryRaw<SqlResult[]>`
      SELECT id FROM "TeacherCampus"
      WHERE "teacherId" = ${teacherId} AND "campusId" = ${campusId}
    `;

    if (!assignment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Teacher is not assigned to this campus"
      });
    }

    // Remove all related assignments
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        DELETE FROM "TeacherSubjectAssignment"
        WHERE "teacherClassAssignmentId" IN (
          SELECT id FROM "TeacherClassAssignment"
          WHERE "teacherCampusId" = ${assignment.id}
        )
      `,
      this.prisma.$executeRaw`
        DELETE FROM "TeacherClassAssignment"
        WHERE "teacherCampusId" = ${assignment.id}
      `,
      this.prisma.$executeRaw`
        DELETE FROM "TeacherCampus"
        WHERE id = ${assignment.id}
      `
    ]);

    return { success: true };
  }
} 