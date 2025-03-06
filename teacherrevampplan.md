# Teacher Management System Revamp Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Database Changes](#database-changes)
3. [API Layer Changes](#api-layer-changes)
4. [UI Component Changes](#ui-component-changes)
5. [Migration Strategy](#migration-strategy)
6. [Testing Plan](#testing-plan)
7. [Rollout Strategy](#rollout-strategy)

## Overview

The goal of this revamp is to implement a campus-centric teacher management system that provides:
- Clear hierarchy: Teacher → Campus → Class → Subject
- Better data consistency and relationships
- Improved query performance
- Enhanced user experience

### Key Changes
1. New database schema for teacher-campus relationships
2. Updated API endpoints for managing assignments
3. Redesigned UI components for teacher management
4. Data migration from existing structure

## Database Changes

### 1. New Schema Models

```prisma
// Modified existing models
model Teacher {
  id            String          @id @default(cuid())
  userId        String          @unique
  user          User           @relation(fields: [userId], references: [id])
  teacherType   TeacherType
  specialization String?
  campusAssignments TeacherCampus[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// New models
model TeacherCampus {
  id            String   @id @default(cuid())
  teacherId     String
  campusId      String
  isPrimary     Boolean  @default(false)
  status        Status   @default(ACTIVE)
  joinedAt      DateTime @default(now())
  teacher       Teacher  @relation(fields: [teacherId], references: [id])
  campus        Campus   @relation(fields: [campusId], references: [id])
  classAssignments TeacherClassAssignment[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([teacherId, campusId])
}

model TeacherClassAssignment {
  id              String   @id @default(cuid())
  teacherCampusId String
  classId         String
  isClassTeacher  Boolean  @default(false)
  status          Status   @default(ACTIVE)
  teacherCampus   TeacherCampus @relation(fields: [teacherCampusId], references: [id])
  class           Class    @relation(fields: [classId], references: [id])
  subjectAssignments TeacherSubjectAssignment[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([teacherCampusId, classId])
}

model TeacherSubjectAssignment {
  id                    String   @id @default(cuid())
  teacherClassAssignmentId String
  subjectId             String
  status                Status   @default(ACTIVE)
  teacherClassAssignment TeacherClassAssignment @relation(fields: [teacherClassAssignmentId], references: [id])
  subject               Subject  @relation(fields: [subjectId], references: [id])
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([teacherClassAssignmentId, subjectId])
}
```

### 2. Migration Files

Create the following migration files:

1. `migrations/[timestamp]_create_teacher_campus_tables.ts`
2. `migrations/[timestamp]_migrate_existing_data.ts`

## API Layer Changes

### 1. New Service Files

```typescript
// src/server/services/TeacherCampusService.ts
export class TeacherCampusService {
  constructor(private prisma: PrismaClient) {}

  async assignTeacherToCampus(data: {
    teacherId: string;
    campusId: string;
    isPrimary: boolean;
  }): Promise<TeacherCampus>

  async assignTeacherToClass(data: {
    teacherCampusId: string;
    classId: string;
    isClassTeacher: boolean;
  }): Promise<TeacherClassAssignment>

  async assignTeacherToSubjects(data: {
    teacherClassAssignmentId: string;
    subjectIds: string[];
  }): Promise<TeacherSubjectAssignment[]>
}
```

### 2. Updated API Routes

```typescript
// src/server/api/routers/teacher.ts
export const teacherRouter = createTRPCRouter({
  // New endpoints
  assignToCampus: protectedProcedure
    .input(z.object({
      teacherId: z.string(),
      campusId: z.string(),
      isPrimary: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new TeacherCampusService(ctx.prisma);
      return service.assignTeacherToCampus(input);
    }),

  assignToClass: protectedProcedure
    .input(z.object({
      teacherCampusId: z.string(),
      classId: z.string(),
      isClassTeacher: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new TeacherCampusService(ctx.prisma);
      return service.assignTeacherToClass(input);
    }),

  // Modified existing endpoints
  createTeacher: protectedProcedure
    .input(teacherCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),

  updateTeacher: protectedProcedure
    .input(teacherUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

## UI Component Changes

### 1. New Components

```typescript
// src/components/dashboard/teacher/TeacherCampusForm.tsx
// Form for managing campus assignments
export function TeacherCampusForm({
  teacherId,
  onSuccess,
}: TeacherCampusFormProps)

// src/components/dashboard/teacher/TeacherClassForm.tsx
// Form for managing class assignments
export function TeacherClassForm({
  teacherCampusId,
  onSuccess,
}: TeacherClassFormProps)

// src/components/dashboard/teacher/TeacherSubjectForm.tsx
// Form for managing subject assignments
export function TeacherSubjectForm({
  teacherClassAssignmentId,
  onSuccess,
}: TeacherSubjectFormProps)
```

### 2. Modified Components

```typescript
// src/components/dashboard/roles/super-admin/teacher/TeacherForm.tsx
// Updated teacher form with new assignment flow
export default function TeacherForm({
  initialData,
  teacherId,
  isCreate,
  campusId,
}: TeacherFormProps)
```

### 3. New Types and Schemas

```typescript
// src/types/teacher.ts
export interface TeacherAssignment {
  campusId: string;
  isPrimary: boolean;
  classes: {
    id: string;
    isClassTeacher: boolean;
    subjects: string[];
  }[];
}

// src/schemas/teacher.ts
export const teacherAssignmentSchema = z.object({
  campusId: z.string(),
  isPrimary: z.boolean(),
  classes: z.array(z.object({
    id: z.string(),
    isClassTeacher: z.boolean(),
    subjects: z.array(z.string()),
  })),
});
```

## Migration Strategy

### 1. Database Migration Steps

1. Create new tables without dropping existing ones
2. Migrate existing data to new structure
3. Validate data consistency
4. Remove old tables/columns after successful migration

### 2. Data Migration Script

```typescript
// scripts/migrate-teacher-data.ts
async function migrateTeacherData() {
  // 1. Get all existing teachers
  const teachers = await prisma.teacher.findMany({
    include: {
      classes: true,
      subjects: true,
    },
  });

  // 2. For each teacher
  for (const teacher of teachers) {
    // Create campus assignments
    // Create class assignments
    // Create subject assignments
  }
}
```

## Testing Plan

### 1. Unit Tests

```typescript
// src/server/services/__tests__/TeacherCampusService.test.ts
describe('TeacherCampusService', () => {
  describe('assignTeacherToCampus', () => {
    // Test cases
  });

  describe('assignTeacherToClass', () => {
    // Test cases
  });
});
```

### 2. Integration Tests

```typescript
// src/server/api/routers/__tests__/teacher.test.ts
describe('teacherRouter', () => {
  describe('assignToCampus', () => {
    // Test cases
  });

  describe('assignToClass', () => {
    // Test cases
  });
});
```

### 3. E2E Tests

```typescript
// cypress/e2e/teacher-management.cy.ts
describe('Teacher Management', () => {
  it('should create a teacher with campus assignments', () => {
    // Test steps
  });

  it('should manage class and subject assignments', () => {
    // Test steps
  });
});
```

## Rollout Strategy

### ✅ Phase 1: Infrastructure (COMPLETED)
1. Created new database schema with the following tables:
   - `TeacherCampus`: Manages teacher-campus relationships
   - `TeacherClassAssignment`: Handles class assignments per campus
   - `TeacherSubjectAssignment`: Manages subject assignments per class
   
2. Implemented core services:
   - Created `TeacherCampusService` with methods for:
     - Assigning teachers to campuses
     - Managing class assignments
     - Handling subject assignments
     - Updating assignment statuses
     - Removing assignments
   
3. Added database optimizations:
   - Created unique constraints for preventing duplicate assignments
   - Added indexes for improved query performance:
     - `idx_teacher_campus_teacher`
     - `idx_teacher_campus_campus`
     - `idx_teacher_class_teacher_campus`
     - `idx_teacher_class_class`
     - `idx_teacher_subject_class`
     - `idx_teacher_subject_subject`
   
4. Created data migration scripts:
   - `migrate-teacher-data.ts` for migrating existing assignments
   - Handles complex relationships and maintains data integrity
   - Includes rollback capabilities

Key Achievements:
- Designed scalable schema for thousands of teachers
- Implemented efficient indexing for high-volume queries
- Created atomic transactions for data consistency
- Added comprehensive error handling
- Maintained backward compatibility

### Phase 2: API Layer (Days 3-4)
1. Implement new API endpoints
2. Update existing endpoints
3. Add API tests

### Phase 3: UI Components (Days 5-7)
1. Create new UI components
2. Update existing forms
3. Add component tests

### Phase 4: Migration (Day 8)
1. Run database migrations
2. Migrate existing data
3. Validate data integrity

### Phase 5: Testing (Days 9-10)
1. Run all test suites
2. Perform manual testing
3. Fix any issues

### Phase 6: Deployment (Days 11-12)
1. Deploy to staging
2. Validate in staging
3. Deploy to production

## Risk Mitigation

### 1. Data Loss Prevention
- Take full database backup before migration
- Run migration in staging first
- Validate data integrity after migration

### 2. Performance Impact
- Index key columns
- Implement query optimization
- Add monitoring

### 3. User Impact
- Provide documentation
- Add UI guidance
- Consider gradual rollout

## Success Metrics

1. Data Integrity
   - All existing teacher assignments preserved
   - No orphaned records
   - Correct relationships maintained

2. Performance
   - Query response times under 200ms
   - No N+1 query issues
   - Efficient data loading

3. User Experience
   - Reduced assignment steps
   - Clear error messages
   - Intuitive UI flow

## Monitoring and Maintenance

1. Performance Monitoring
   - Track query times
   - Monitor database load
   - Track API response times

2. Error Tracking
   - Log assignment failures
   - Track validation errors
   - Monitor user feedback

3. Maintenance Plan
   - Regular performance reviews
   - Periodic data integrity checks
   - User feedback collection

## Documentation

1. API Documentation
   - New endpoints
   - Modified endpoints
   - Request/response examples

2. UI Documentation
   - Component usage
   - Props documentation
   - State management

3. Database Documentation
   - Schema changes
   - Relationships
   - Indexes and constraints

## Timeline

Total Duration: 12-14 days

1. Infrastructure Setup: 2 days
2. API Development: 2 days
3. UI Development: 3 days
4. Migration: 1 day
5. Testing: 2 days
6. Deployment: 2 days
7. Buffer: 2 days

## Dependencies

1. External
   - Prisma ORM
   - tRPC
   - React Hook Form
   - Zod

2. Internal
   - User Service
   - Permission Service
   - Campus Service

## Next Steps

1. Review and approve plan
2. Set up project tracking
3. Begin infrastructure phase
4. Schedule regular checkpoints 