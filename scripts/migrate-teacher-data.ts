import { PrismaClient, Status, TeacherType } from "@prisma/client";

interface TeacherData {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
}

interface ClassAssignment {
  id: string;
  isClassTeacher: boolean;
  isPrimary: boolean;
  status: Status;
  createdAt: Date;
  classId: string;
  campusId: string;
  subjectIds: string[];
}

interface SqlResult {
  id: string;
}

const prisma = new PrismaClient();

async function migrateTeacherData() {
  console.log("Starting teacher data migration...");

  try {
    // Get all teachers with their basic info
    const teachers = await prisma.$queryRaw<TeacherData[]>`
      SELECT 
        tp.id,
        tp."userId",
        u.name as "userName",
        u.email as "userEmail"
      FROM "TeacherProfile" tp
      JOIN "User" u ON u.id = tp."userId"
      WHERE tp.status = ${Status.ACTIVE}
    `;

    console.log(`Found ${teachers.length} teachers to migrate`);

    for (const teacher of teachers) {
      console.log(`Migrating teacher: ${teacher.userName} (${teacher.id})`);

      // Get all class assignments for this teacher
      const assignments = await prisma.$queryRaw<ClassAssignment[]>`
        SELECT 
          ta.id,
          ta."isClassTeacher",
          ta."isPrimary",
          ta.status,
          ta."createdAt",
          c.id as "classId",
          p."campusId",
          array_agg(ts."subjectId") as "subjectIds"
        FROM "TeacherAssignment" ta
        JOIN "Class" c ON c.id = ta."classId"
        JOIN "ClassGroup" cg ON cg.id = c."classGroupId"
        JOIN "Program" p ON p.id = cg."programId"
        LEFT JOIN "TeacherSubject" ts ON ts."teacherId" = ta."teacherId"
        WHERE ta."teacherId" = ${teacher.id}
        GROUP BY ta.id, ta."isClassTeacher", ta."isPrimary", ta.status, ta."createdAt", c.id, p."campusId"
      `;

      // Group assignments by campus
      const assignmentsByCampus = assignments.reduce<Record<string, ClassAssignment[]>>((acc, assignment) => {
        if (!acc[assignment.campusId]) {
          acc[assignment.campusId] = [];
        }
        acc[assignment.campusId].push(assignment);
        return acc;
      }, {});

      // For each campus, create TeacherCampus and related assignments
      for (const [campusId, campusAssignments] of Object.entries(assignmentsByCampus)) {
        console.log(`Processing campus ${campusId} with ${campusAssignments.length} assignments`);

        // Create TeacherCampus
        const [teacherCampus] = await prisma.$queryRaw<SqlResult[]>`
          INSERT INTO "TeacherCampus" ("id", "teacherId", "campusId", "isPrimary", "status", "joinedAt", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${teacher.id}, ${campusId}, ${campusAssignments.some(a => a.isPrimary)}, ${Status.ACTIVE}, ${new Date(Math.min(...campusAssignments.map(a => a.createdAt.getTime())))}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `;

        // Create TeacherClassAssignments and TeacherSubjectAssignments
        for (const assignment of campusAssignments) {
          const [classAssignment] = await prisma.$queryRaw<SqlResult[]>`
            INSERT INTO "TeacherClassAssignment" ("id", "teacherCampusId", "classId", "isClassTeacher", "status", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), ${teacherCampus.id}, ${assignment.classId}, ${assignment.isClassTeacher}, ${assignment.status}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `;

          if (assignment.subjectIds.length > 0) {
            for (const subjectId of assignment.subjectIds) {
              if (subjectId) {
                await prisma.$executeRaw`
                  INSERT INTO "TeacherSubjectAssignment" ("id", "teacherClassAssignmentId", "subjectId", "status", "createdAt", "updatedAt")
                  VALUES (gen_random_uuid(), ${classAssignment.id}, ${subjectId}, ${Status.ACTIVE}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `;
              }
            }
          }
        }
      }

      console.log(`Successfully migrated teacher: ${teacher.userName}`);
    }

    console.log("Teacher data migration completed successfully");
  } catch (error) {
    console.error("Error during teacher data migration:", error);
    throw error;
  }
}

// Execute migration
migrateTeacherData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  }); 