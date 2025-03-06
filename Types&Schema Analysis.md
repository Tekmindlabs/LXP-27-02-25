# Schema Simplification and Consolidation Plan

After analyzing the current Prisma schema, I can see that there are indeed many overlapping models and complex relationships that could be simplified. Here's a comprehensive plan to streamline your schema while maintaining backward compatibility and ensuring comprehensive associations.

## Current Issues

1. **Duplicate Models**: Multiple models serving similar purposes (e.g., `ClassActivity` and `Activity`)
2. **Complex Hierarchies**: Deep nested structures (e.g., Building → Floor → Wing → Room)
3. **Inconsistent Relationship Patterns**: Some use direct references while others use junction tables
4. **Redundant Physical Space Models**: Overlapping functionality between models like Room and Classroom
5. **Parallel Activity Models**: Confusion about when to use different activity models

## Simplification Strategy

### 1. Campus Structure Consolidation

**Current Structure:**
```
Campus → Building → Floor → Wing → Room
```

**Simplified Structure:**
```prisma
model Campus {
  id                String     @id @default(cuid())
  name              String
  code              String     @unique
  // Other campus fields...
  
  // Direct relation to rooms
  rooms             CampusRoom[]
  
  // Other relations...
}

model CampusRoom {
  id                String     @id @default(cuid())
  number            String
  name              String?
  campusId          String
  campus            Campus     @relation(fields: [campusId], references: [id])
  buildingName      String     // Denormalized for querying
  floorNumber       Int?       // Denormalized for querying
  wingName          String?    // Denormalized for querying
  type              RoomType
  capacity          Int
  status            RoomStatus
  resources         Json?
  
  // Relations
  classes           Class[]
  
  @@unique([campusId, number])
  @@index([campusId, buildingName])
}
```

**Benefits:**
- Simplifies queries for room allocation
- Maintains building/floor/wing information as denormalized fields
- Reduces the number of joins needed for common operations

### 2. Activity Model Unification

**Current Structure:**
```
ClassActivity, Activity, UnifiedActivityResource, ClassActivityResource, etc.
```

**Simplified Structure:**
```prisma
model Activity {
  id                String         @id @default(cuid())
  title             String
  description       String?
  type              ActivityType
  status            ActivityStatus
  scope             ActivityScope  @default(CLASS)
  
  // Relations
  subjectId         String
  subject           Subject        @relation(fields: [subjectId], references: [id])
  classId           String?
  class             Class?         @relation(fields: [classId], references: [id])
  CourseId      String?
  Course        Course?    @relation(fields: [CourseId], references: [id])
  curriculumNodeId  String?
  curriculumNode    CurriculumNode? @relation(fields: [curriculumNodeId], references: [id])
  
  // Template functionality
  isTemplate        Boolean        @default(false)
  templateId        String?
  template          Activity?      @relation("ActivityTemplates", fields: [templateId], references: [id])
  derivedActivities Activity[]     @relation("ActivityTemplates")
  
  // Configuration
  configuration     Json
  resources         ActivityResource[]
  submissions       ActivitySubmission[]
  inheritedBy       ActivityInheritance[]
  
  // Timestamps
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([subjectId])
  @@index([classId])
  @@index([CourseId])
  @@index([curriculumNodeId])
}

model ActivityResource {
  id                String     @id @default(cuid())
  title             String
  type              String
  url               String
  activity          Activity   @relation(fields: [activityId], references: [id])
  activityId        String
  
  @@index([activityId])
}

model ActivitySubmission {
  id                String           @id @default(cuid())
  activityId        String
  activity          Activity         @relation(fields: [activityId], references: [id])
  studentId         String
  student           Student          @relation(fields: [studentId], references: [id])
  status            SubmissionStatus @default(PENDING)
  submittedAt       DateTime?
  obtainedMarks     Float?
  feedback          String?
  resources         Json?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  @@unique([activityId, studentId])
  @@index([studentId])
}

model ActivityInheritance {
  id                String     @id @default(cuid())
  activity          Activity   @relation(fields: [activityId], references: [id])
  activityId        String
  classId           String
  class             Class      @relation(fields: [classId], references: [id])
  inherited         Boolean    @default(true)
  
  @@unique([activityId, classId])
  @@index([activityId])
  @@index([classId])
}
```

**Benefits:**
- Single activity model for all contexts
- Clear template relationship
- Simplified inheritance model
- Consistent resource and submission handling

### 3. User Profile Consolidation

**Current Structure:**
```
User → TeacherProfile, CoordinatorProfile, ParentProfile, Student
```

**Simplified Structure:**
```prisma
model User {
  id                String    @id @default(cuid())
  name              String?
  email             String?   @unique
  // Other user fields...
  
  // Profile fields
  userType          UserType
  teacherDetails    TeacherDetails?
  coordinatorDetails CoordinatorDetails?
  studentDetails    StudentDetails?
  parentDetails     ParentDetails?
  
  // Relations
  campusRoles       CampusRole[]
  // Other relations...
}

model TeacherDetails {
  id                String     @id @default(cuid())
  userId            String     @unique
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  teacherType       TeacherType @default(SUBJECT)
  specialization    String?
  availability      String?
  
  // Relations
  subjects          TeacherSubject[]
  classes           TeacherClass[]
  campuses          TeacherCampus[]
  
  @@index([userId])
}

// Similar models for CoordinatorDetails, StudentDetails, ParentDetails
```

**Benefits:**
- Maintains the User as the central entity
- Simplifies queries for user information
- Reduces the need for complex joins
- Clearer separation of concerns

### 4. Campus-User Relationship Simplification

**Current Structure:**
Complex relationships between users, campuses, and roles

**Simplified Structure:**
```prisma
model CampusRole {
  id                String     @id @default(cuid())
  userId            String
  user              User       @relation(fields: [userId], references: [id])
  campusId          String
  campus            Campus     @relation(fields: [campusId], references: [id])
  role              String     // Enum as string: "TEACHER", "STUDENT", "COORDINATOR", "ADMIN"
  permissions       String[]   // Array of permission strings
  isPrimary         Boolean    @default(false)
  status            Status     @default(ACTIVE)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([userId, campusId, role])
  @@index([userId])
  @@index([campusId])
}
```

**Benefits:**
- Simplifies role and permission management
- Provides a direct relationship between users and campuses
- Supports multiple roles per user per campus

### 5. Class and Course Simplification

**Current Structure:**
Complex relationships between programs, Courses, and classes

**Simplified Structure:**
```prisma
model Program {
  id                String     @id @default(cuid())
  name              String?    @unique
  // Other program fields...
  
  // Direct relation to classes
  classes           Class[]
  
  // Other relations...
}

model Class {
  id                String     @id @default(cuid())
  name              String
  code              String     @unique
  programId         String
  program           Program    @relation(fields: [programId], references: [id])
  campusId          String
  campus            Campus     @relation(fields: [campusId], references: [id])
  roomId            String?
  room              CampusRoom? @relation(fields: [roomId], references: [id])
  
  // Course information as fields
  CourseName    String?
  CourseId      String?    // For backward compatibility
  
  // Relations
  students          ClassStudent[]
  teachers          ClassTeacher[]
  activities        Activity[]
  
  // Other fields...
  
  @@index([programId])
  @@index([campusId])
}

model ClassStudent {
  id                String     @id @default(cuid())
  classId           String
  class             Class      @relation(fields: [classId], references: [id])
  studentId         String
  student           User       @relation(fields: [studentId], references: [id])
  status            Status     @default(ACTIVE)
  joinedAt          DateTime   @default(now())
  
  @@unique([classId, studentId])
  @@index([studentId])
}

model ClassTeacher {
  id                String     @id @default(cuid())
  classId           String
  class             Class      @relation(fields: [classId], references: [id])
  teacherId         String
  teacher           User       @relation(fields: [teacherId], references: [id])
  isClassTeacher    Boolean    @default(false)
  subjectId         String?
  subject           Subject?   @relation(fields: [subjectId], references: [id])
  status            Status     @default(ACTIVE)
  
  @@unique([classId, teacherId, subjectId])
  @@index([teacherId])
}
```

**Benefits:**
- Simplifies the class hierarchy
- Maintains Course information as denormalized fields
- Clearer student and teacher assignments

##

1. **Simplified Queries**: Fewer joins and more direct relationships
2. **Reduced Redundancy**: Elimination of duplicate models and parallel structures
3. **Improved Maintainability**: Clearer model relationships and responsibilities
4. **Better Performance**: More efficient queries with fewer joins
5. **Backward Compatibility**: Migration strategy ensures smooth transition

By implementing these changes, you'll create a more streamlined schema that's easier to work with while maintaining all the functionality of your current system.

# Continued Schema Simplification Plan

Building on the previous simplification strategy, let's address the timetable, gradebook, subjects, and remaining entities to create a more streamlined and efficient schema.

## 4. Timetable Simplification

**Current Structure:**
```
Timetable → Period, BreakTime, multiple relationships to Class, Course, Term
```

**Simplified Structure:**
```prisma
model Timetable {
  id                String     @id @default(cuid())
  name              String?
  termId            String
  term              Term       @relation(fields: [termId], references: [id])
  classId           String?
  class             Class?     @relation(fields: [classId], references: [id])
  startTime         String     // Daily start time in HH:mm format
  endTime           String     // Daily end time in HH:mm format
  
  // Relations
  periods           Period[]
  breakTimes        BreakTime[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([termId])
  @@index([classId])
  @@unique([termId, classId])
}

model Period {
  id                String     @id @default(cuid())
  timetableId       String
  timetable         Timetable  @relation(fields: [timetableId], references: [id], onDelete: Cascade)
  startTime         String     // HH:mm format
  endTime           String     // HH:mm format
  daysOfWeek        Int[]      // Array of day numbers (1-7)
  subjectId         String
  subject           Subject    @relation(fields: [subjectId], references: [id])
  teacherId         String
  teacher           User       @relation(fields: [teacherId], references: [id])
  roomId            String
  room              CampusRoom @relation(fields: [roomId], references: [id])
  
  @@index([timetableId])
  @@index([subjectId])
  @@index([teacherId])
  @@index([roomId])
}

model BreakTime {
  id                String     @id @default(cuid())
  timetableId       String
  timetable         Timetable  @relation(fields: [timetableId], references: [id], onDelete: Cascade)
  startTime         String     // HH:mm format
  endTime           String     // HH:mm format
  dayOfWeek         Int        // Day number (1-7)
  type              String     // "SHORT_BREAK" or "LUNCH_BREAK"
  
  @@index([timetableId])
}
```

**Benefits:**
- Simplified relationship between timetable and class
- Removed redundant Course reference (accessible through Class)
- Consistent time format handling
- Cascade deletion for periods and break times

## 5. Gradebook Simplification

**Current Structure:**
```
GradeBook → SubjectGradeRecord → StudentSubjectGrade → GradeHistory
```

**Simplified Structure:**
```prisma
model GradeBook {
  id                String     @id @default(cuid())
  classId           String     @unique
  class             Class      @relation(fields: [classId], references: [id])
  
  // Relations
  grades            StudentGrade[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
}

model StudentGrade {
  id                String     @id @default(cuid())
  gradeBookId       String
  gradeBook         GradeBook  @relation(fields: [gradeBookId], references: [id], onDelete: Cascade)
  studentId         String
  student           User       @relation(fields: [studentId], references: [id])
  subjectId         String
  subject           Subject    @relation(fields: [subjectId], references: [id])
  termId            String
  term              Term       @relation(fields: [termId], references: [id])
  
  // Grade data
  grade             String?
  score             Float?
  totalMarks        Float?
  percentage        Float?
  isPassing         Boolean    @default(false)
  comments          String?
  
  // Metadata
  gradedAt          DateTime?
  gradedById        String?
  gradedBy          User?      @relation("GradedBy", fields: [gradedById], references: [id])
  
  // History tracking
  history           GradeHistory[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([gradeBookId, studentId, subjectId, termId])
  @@index([gradeBookId])
  @@index([studentId])
  @@index([subjectId])
  @@index([termId])
}

model GradeHistory {
  id                String     @id @default(cuid())
  studentGradeId    String
  studentGrade      StudentGrade @relation(fields: [studentGradeId], references: [id], onDelete: Cascade)
  
  // Previous values
  previousGrade     String?
  previousScore     Float?
  previousPercentage Float?
  
  // New values
  newGrade          String?
  newScore          Float?
  newPercentage     Float?
  
  // Change metadata
  changedById       String
  changedBy         User       @relation(fields: [changedById], references: [id])
  changedAt         DateTime   @default(now())
  reason            String?
  
  @@index([studentGradeId])
  @@index([changedById])
}

model TermResult {
  id                String     @id @default(cuid())
  studentId         String
  student           User       @relation(fields: [studentId], references: [id])
  termId            String
  term              Term       @relation(fields: [termId], references: [id])
  classId           String
  class             Class      @relation(fields: [classId], references: [id])
  
  // Result data
  gpa               Float
  totalCredits      Float
  earnedCredits     Float
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([studentId, termId, classId])
  @@index([studentId])
  @@index([termId])
  @@index([classId])
}
```

**Benefits:**
- Flattened hierarchy for easier querying
- Direct relationships between grades and related entities
- Simplified grade history tracking
- Consolidated term results

## 6. Subject Simplification

**Current Structure:**
```
Subject → SubjectTeacher, SubjectCoordinator, SubjectResource, etc.
```

**Simplified Structure:**
```prisma
model Subject {
  id                String     @id @default(cuid())
  name              String
  code              String     @unique
  description       String?
  credits           Float      @default(1)
  type              String     @default("THEORY") // "THEORY", "PRACTICAL", "HYBRID"
  status            Status     @default(ACTIVE)
  
  // Curriculum association
  curriculumId      String?
  curriculum        Curriculum? @relation(fields: [curriculumId], references: [id])
  
  // Relations
  teachers          SubjectTeacher[]
  resources         SubjectResource[]
  activities        Activity[]
  periods           Period[]
  grades            StudentGrade[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([curriculumId])
}

model SubjectTeacher {
  id                String     @id @default(cuid())
  subjectId         String
  subject           Subject    @relation(fields: [subjectId], references: [id])
  teacherId         String
  teacher           User       @relation(fields: [teacherId], references: [id])
  classId           String?
  class             Class?     @relation(fields: [classId], references: [id])
  isPrimary         Boolean    @default(false)
  status            Status     @default(ACTIVE)
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([subjectId, teacherId, classId])
  @@index([subjectId])
  @@index([teacherId])
  @@index([classId])
}

model SubjectResource {
  id                String     @id @default(cuid())
  subjectId         String
  subject           Subject    @relation(fields: [subjectId], references: [id])
  title             String
  description       String?
  type              String     // "DOCUMENT", "VIDEO", "LINK", etc.
  url               String
  isPublic          Boolean    @default(false)
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([subjectId])
}
```

**Benefits:**
- Simplified subject model with direct relationships
- Removed redundant coordinator model (use SubjectTeacher with isPrimary)
- Consolidated resource management
- Clear relationship with curriculum

## 7. Assessment System Simplification

**Current Structure:**
```
AssessmentSystem → MarkingScheme, Rubric, CGPAConfig, etc.
```

**Simplified Structure:**
```prisma
model AssessmentSystem {
  id                String     @id @default(cuid())
  name              String
  type              String     // "MARKING_SCHEME", "RUBRIC", "HYBRID", "CGPA"
  
  // Configuration stored as JSON
  configuration     Json
  
  // Program association
  programId         String?
  program           Program?   @relation(fields: [programId], references: [id])
  
  // Class association (for overrides)
  classId           String?
  class             Class?     @relation(fields: [classId], references: [id])
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([programId])
  @@index([classId])
}
```

**Benefits:**
- Single model for all assessment system types
- Flexible configuration using JSON
- Clear association with programs and classes
- Simplified querying and management

## 8. Curriculum Simplification

**Current Structure:**
```
Curriculum → CurriculumNode → CurriculumNodeResource, etc.
```

**Simplified Structure:**
```prisma
model Curriculum {
  id                String     @id @default(cuid())
  name              String
  description       String?
  version           String     @default("1.0")
  status            Status     @default(ACTIVE)
  
  // Program association
  programId         String?
  program           Program?   @relation(fields: [programId], references: [id])
  
  // Relations
  nodes             CurriculumNode[]
  subjects          Subject[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([programId])
}

model CurriculumNode {
  id                String     @id @default(cuid())
  title             String
  description       String?
  type              String     // "UNIT", "CHAPTER", "TOPIC", etc.
  order             Int        @default(0)
  
  // Curriculum association
  curriculumId      String
  curriculum        Curriculum @relation(fields: [curriculumId], references: [id])
  
  // Hierarchical structure
  parentId          String?
  parent            CurriculumNode? @relation("NodeHierarchy", fields: [parentId], references: [id])
  children          CurriculumNode[] @relation("NodeHierarchy")
  
  // Content
  content           String?    // Markdown or HTML content
  resources         CurriculumResource[]
  activities        Activity[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([curriculumId])
  @@index([parentId])
}

model CurriculumResource {
  id                String     @id @default(cuid())
  title             String
  description       String?
  type              String     // "DOCUMENT", "VIDEO", "LINK", etc.
  url               String
  
  // Node association
  nodeId            String
  node              CurriculumNode @relation(fields: [nodeId], references: [id])
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@index([nodeId])
}
```

**Benefits:**
- Simplified curriculum structure
- Clear hierarchical relationship for curriculum nodes
- Direct association with subjects
- Streamlined resource management

## 9. Attendance Simplification

**Current Structure:**
```
AttendanceRecord → StudentAttendance, multiple relationships
```

**Simplified Structure:**
```prisma
model Attendance {
  id                String     @id @default(cuid())
  date              DateTime
  classId           String
  class             Class      @relation(fields: [classId], references: [id])
  subjectId         String?
  subject           Subject?   @relation(fields: [subjectId], references: [id])
  
  // Relations
  records           AttendanceRecord[]
  
  // Metadata
  takenById         String
  takenBy           User       @relation(fields: [takenById], references: [id])
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([date, classId, subjectId])
  @@index([classId])
  @@index([subjectId])
  @@index([takenById])
}

model AttendanceRecord {
  id                String     @id @default(cuid())
  attendanceId      String
  attendance        Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  studentId         String
  student           User       @relation(fields: [studentId], references: [id])
  status            String     // "PRESENT", "ABSENT", "LATE", "EXCUSED"
  remarks           String?
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([attendanceId, studentId])
  @@index([attendanceId])
  @@index([studentId])
}
```

**Benefits:**
- Simplified attendance tracking
- Clear relationship between attendance and records
- Reduced redundancy in attendance data
- Easier querying for attendance reports

## 10. Notification System Simplification

**Current Structure:**
```
Notification → NotificationRecipient, NotificationSetting, etc.
```

**Simplified Structure:**
```prisma
model Notification {
  id                String     @id @default(cuid())
  title             String
  content           String
  type              String     // "ANNOUNCEMENT", "ASSIGNMENT", "GRADE", etc.
  priority          String     @default("NORMAL") // "LOW", "NORMAL", "HIGH", "URGENT"
  
  // Sender
  senderId          String
  sender            User       @relation("SentNotifications", fields: [senderId], references: [id])
  
  // Context
  contextType       String?    // "CLASS", "SUBJECT", "ACTIVITY", etc.
  contextId         String?    // ID of the related entity
  
  // Recipients
  recipients        NotificationRecipient[]
  
  // Timestamps
  createdAt         DateTime   @default(now())
  expiresAt         DateTime?
  
  @@index([senderId])
  @@index([contextType, contextId])
}

model NotificationRecipient {
  id                String     @id @default(cuid())
  notificationId    String
  notification      Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  userId            String
  user              User       @relation(fields: [userId], references: [id])
  
  // Status
  isRead            Boolean    @default(false)
  readAt            DateTime?
  isArchived        Boolean    @default(false)
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  @@unique([notificationId, userId])
  @@index([notificationId])
  @@index([userId])
  @@index([isRead])
}

model NotificationPreference {
  id                String     @id @default(cuid())
  userId            String     @unique
  user              User       @relation(fields: [userId], references: [id])
  
  // Preferences as JSON
  preferences       Json       // { "ANNOUNCEMENT": { "email": true, "push": true }, ... }
  
  // Timestamps
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
}
```

