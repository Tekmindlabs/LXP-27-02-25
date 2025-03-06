# Learning Experience Platform - System Architecture

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Core_Platform
        Institution[Institution Management]
        Academic[Academic Management]
        Learning[Learning Management]
        Assessment[Assessment System]
        User[User Management]
    end

    subgraph Infrastructure
        Auth[Authentication]
        DataStore[Data Storage]
        Cache[Caching Layer]
        Analytics[Analytics Engine]
    end

    subgraph Domain_Services
        Campus[Campus Management]
        Program[Program Management]
        Class[Class Management]
        Activity[Activity Management]
        Attendance[Attendance System]
    end

    Institution --> Program
    Program --> Class
    Class --> Activity
    Class --> Attendance
    Learning --> Activity
    Assessment --> Activity
    User --> Auth
    
    Campus --> Class
    Program --> Academic
    Academic --> Assessment

## 2. Core Domain Models

### 2.1 Institution Hierarchy
```mermaid
erDiagram
    Institution ||--o{ Campus : has
    Institution ||--o{ Program : offers
    Campus ||--o{ CampusProgram : implements
    Program ||--o{ Course : contains
    Course ||--o{ Subject : includes
    CampusProgram ||--o{ Class : manages
```

### 2.2 Learning Management
```mermaid
erDiagram
    LearningPath ||--o{ LearningModule : contains
    LearningModule ||--o{ UnifiedActivity : has
    UnifiedActivity ||--o{ ActivitySubmission : receives
    UnifiedActivity ||--o{ ActivityResource : uses
    LearningModule ||--o{ LearningOutcome : achieves
    LearningOutcome ||--o{ Competency : develops
```

### 2.3 Assessment System
```mermaid
erDiagram
    Class ||--|| GradeBook : has
    GradeBook ||--o{ StudentGrade : contains
    UnifiedActivity ||--o{ ActivitySubmission : assesses
    ActivitySubmission ||--|| ActivityGrade : receives
    AssessmentPeriod ||--o{ Assessment : schedules
```

### 2.4 Attendance System
```mermaid
erDiagram
    Class ||--o{ AttendanceSession : schedules
    AttendanceSession ||--o{ AttendanceRecord : tracks
    AttendanceRecord }|--|| User : belongs_to
```

### 2.5 User Profile and Role Management
```mermaid
erDiagram
    User ||--|| Profile : has
    Profile ||--o{ Document : stores
    Profile ||--o{ EmergencyContact : has
    Profile ||--o{ DataConsent : manages
    Profile ||--o{ Transfer : records
    
    Profile ||--o{ TeacherDetails : extends
    Profile ||--o{ StudentDetails : extends
    Profile ||--o{ CoordinatorDetails : extends
    
    TeacherDetails ||--o{ TeacherSubject : teaches
    TeacherDetails ||--o{ TeacherClass : manages
    TeacherDetails ||--o{ Qualification : has
    TeacherDetails ||--o{ WorkExperience : has
    
    StudentDetails ||--o{ ClassStudent : enrolls
    StudentDetails ||--o{ Achievement : earns
    StudentDetails ||--o{ PreviousEducation : records
```

### 2.6 Academic Structure
```mermaid
erDiagram
    Program ||--|| TermSystem : has
    TermSystem ||--o{ Term : contains
    Term ||--o{ AssessmentPeriod : schedules
    Term ||--o{ TermEnrollment : tracks
    
    Course ||--o{ Subject : contains
    Subject ||--o{ TeacherSubject : taught_by
    Subject ||--o{ StudentGrade : grades
    
    Curriculum ||--o{ CurriculumNode : structures
    CurriculumNode ||--o{ LearningOutcome : achieves
    CurriculumNode ||--o{ Competency : develops
```

## 3. Data Flow Architecture

### 3.1 User Interaction Flow
```mermaid
sequenceDiagram
    participant User
    participant Auth
    participant Service
    participant Cache
    participant DB

    User->>Auth: Authenticate
    Auth->>Service: Authorize
    Service->>Cache: Check Cache
    Cache-->>Service: Cache Hit/Miss
    Service->>DB: Query if needed
    DB-->>Service: Data
    Service->>Cache: Update Cache
    Service-->>User: Response
```

### 3.2 Activity Flow
```mermaid
sequenceDiagram
    participant Teacher
    participant System
    participant Student
    participant Assessment

    Teacher->>System: Create Activity
    System->>Student: Notify
    Student->>System: Submit Work
    System->>Assessment: Grade
    Assessment->>System: Update Grade
    System->>Student: Notify Result
```

## 4. Key Components

### 4.1 Core Services
- **Institution Management**
  - Institution configuration
  - Campus management
  - Program administration

- **Academic Management**
  - Course management
  - Curriculum planning
  - Term system management

- **Learning Management**
  - Learning path creation
  - Module management
  - Activity coordination
  - Resource management

- **Assessment System**
  - Grading management
  - Performance tracking
  - Competency assessment

### 4.2 Support Services
- **User Management**
  - Profile management
  - Role-based access control
  - User authentication

- **Data Management**
  - Data partitioning
  - Sharding configuration
  - Caching strategies

## 5. Database Design

### 5.1 Optimization Strategies
```mermaid
graph LR
    subgraph Performance_Optimization
        Sharding[Sharding Strategy]
        Partitioning[Data Partitioning]
        Caching[Caching Layer]
        Views[Materialized Views]
    end

    subgraph Data_Access_Patterns
        Read[Read Operations]
        Write[Write Operations]
        Analytics[Analytical Queries]
    end

    Sharding --> Performance
    Partitioning --> Performance
    Caching --> Performance
    Views --> Performance
```

### 5.2 Data Access Patterns
- **Frequent Read Operations**
  - Class summaries
  - Student profiles
  - Activity status

### 5.3 Data Optimization Models
```mermaid
erDiagram
    DataView ||--o{ QueryOptimization : uses
    ClassSummary ||--|| Class : summarizes
    StudentSummary ||--|| StudentDetails : summarizes
    
    ShardConfig ||--o{ PartitionConfig : configures
    PartitionConfig ||--o{ DataView : optimizes
```

### 5.4 Analytics and Reporting
```mermaid
sequenceDiagram
    participant Analytics Engine
    participant Summary Tables
    participant Raw Data
    participant Cache

    Analytics Engine->>Summary Tables: Query Aggregated Data
    Summary Tables->>Raw Data: Refresh if Needed
    Analytics Engine->>Cache: Store Results
    Cache-->>Analytics Engine: Serve Cached Analytics
```

Key Analytics Models:
- **ClassSummary**
  - Student counts
  - Attendance rates
  - Performance metrics
  - Activity statistics

- **StudentSummary**
  - Enrollment status
  - Academic performance
  - Attendance patterns
  - Risk assessment

- **DataView**
  - Custom analytics views
  - Performance optimized queries
  - Role-based access control
  - Automated refresh cycles

## 6. Security Architecture

### 6.1 Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant Auth
    participant RBAC
    participant Service

    User->>Auth: Login Request
    Auth->>RBAC: Get Permissions
    RBAC->>Service: Authorize Access
    Service-->>User: Protected Resource
```

### 6.2 Data Protection
- Role-based access control
- Data encryption
- Audit logging
- GDPR compliance

### 6.3 GDPR and Data Protection
```mermaid
erDiagram
    Profile ||--|| DataConsent : requires
    DataConsent ||--o{ ConsentHistory : tracks
    Profile ||--o{ Document : manages
    Document }|--|| DataClassification : has
    
    DataConsent {
        boolean consentStatus
        datetime consentDate
        json dataUsageConsent
        boolean marketingConsent
        boolean thirdPartyConsent
        int retentionPeriod
    }
    
    ConsentHistory {
        string action
        json details
        datetime timestamp
    }
    
    Document {
        string type
        datetime expiryDate
        enum classification
        int retentionPeriod
    }
```

Key GDPR Features:
- **Consent Management**
  - Explicit user consent tracking
  - Granular consent options
  - Consent history and audit trail
  - Automated consent expiration

- **Data Retention**
  - Configurable retention periods
  - Automated data cleanup
  - Data classification
  - Document lifecycle management

- **Data Subject Rights**
  - Right to access
  - Right to be forgotten
  - Data portability
  - Consent withdrawal

## 7. Technical Implementation

### 7.1 tRPC and Prisma Integration
```mermaid
graph TB
    subgraph Client_Layer
        UI[ShadCn Ui]
        Hooks[tRPC Hooks]
        Types[Type Definitions]
    end

    subgraph API_Layer
        Router[tRPC Router]
        Procedures[tRPC Procedures]
        Middleware[tRPC Middleware]
    end

    subgraph Data_Layer
        PrismaClient[Prisma Client]
        Models[Prisma Models]
        Migrations[Prisma Migrations]
    end

    UI --> Hooks
    Hooks --> Router
    Router --> Procedures
    Procedures --> PrismaClient
    PrismaClient --> Models
```

### 7.2 API Structure
```mermaid
graph LR
    subgraph tRPC_Routers
        direction TB
        InstitutionRouter[Institution Router]
        AcademicRouter[Academic Router]
        UserRouter[User Router]
        AttendanceRouter[Attendance Router]
        ActivityRouter[Activity Router]
    end

    subgraph Procedures
        direction TB
        Queries[Query Procedures]
        Mutations[Mutation Procedures]
        Subscriptions[Subscription Procedures]
    end

    subgraph Middleware
        Auth[Authentication]
        Validation[Input Validation]
        Caching[Response Caching]
        Logging[Request Logging]
    end

    tRPC_Routers --> Procedures
    Procedures --> Middleware
```

### 7.3 Type-Safe Data Flow
```typescript
// Example type-safe procedure
interface ExampleRouter {
  // Queries
  getInstitution: {
    input: { id: string };
    output: InstitutionWithRelations;
  };
  
  // Mutations
  createCourse: {
    input: CreateCourseInput;
    output: Course;
  };
  
  // Subscriptions
  onAttendanceUpdate: {
    input: { sessionId: string };
    output: AttendanceRecord;
  };
}

// Middleware example
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

// Procedure example
const createActivityProcedure = protectedProcedure
  .input(createActivitySchema)
  .mutation(async ({ ctx, input }) => {
    return ctx.prisma.unifiedActivity.create({
      data: input,
      include: {
        module: true,
        submissions: true,
      },
    });
  });
```

### 7.4 Key Implementation Features

#### Prisma Integration
- **Model Definition**
  ```prisma
  // Example of type-safe model usage
  model UnifiedActivity {
    id          String   @id @default(cuid())
    title       String
    type        ActivityType
    moduleId    String
    module      LearningModule @relation(fields: [moduleId], references: [id])
    submissions ActivitySubmission[]
    // ... other fields
  }
  ```

- **Type-Safe Queries**
  ```typescript
  // Example of type-safe query
  const getActivityWithSubmissions = async (activityId: string) => {
    return prisma.unifiedActivity.findUnique({
      where: { id: activityId },
      include: {
        submissions: {
          include: {
            user: true,
            grades: true,
          },
        },
      },
    });
  };
  ```

#### tRPC Features
- **Type Safety**
  - End-to-end type safety
  - Automatic type inference
  - Shared types between client and server

- **Performance**
  - Automatic request batching
  - Response caching
  - Optimistic updates

- **Security**
  - Input validation
  - Authentication middleware
  - Role-based access control

#### Integration Patterns
- **Repository Pattern**
  ```typescript
  class ActivityRepository {
    constructor(private prisma: PrismaClient) {}

    async createActivity(data: CreateActivityInput) {
      return this.prisma.unifiedActivity.create({
        data,
        include: { /* relations */ },
      });
    }
  }
  ```

- **Service Layer**
  ```typescript
  class ActivityService {
    constructor(private repo: ActivityRepository) {}

    async createActivity(input: CreateActivityInput, userId: string) {
      // Business logic
      const activity = await this.repo.createActivity({
        ...input,
        createdById: userId,
      });
      
      // Additional operations
      await this.notificationService.notifyStudents(activity);
      return activity;
    }
  }
  ```

### 7.5 Data Access Optimization
```mermaid
graph TB
    subgraph Query_Optimization
        BatchQueries[Request Batching]
        CacheLayer[Response Caching]
        PrismaMiddleware[Prisma Middleware]
    end

    subgraph Performance_Features
        ConnectionPool[Connection Pooling]
        QueryBatching[Query Batching]
        Transactions[Transactions]
    end

    BatchQueries --> Performance
    CacheLayer --> Performance
    PrismaMiddleware --> Performance
    ConnectionPool --> Database
    QueryBatching --> Database
    Transactions --> Database
```

## 8. Vector Database and Knowledge Base Architecture

### 8.1 Vector Database Integration
```mermaid
graph TB
    subgraph Vector_Storage
        LanceDB[LanceDB]
        Vectors[Vector Embeddings]
        Tables[Vector Tables]
    end

    subgraph Knowledge_Base
        Content[Content Storage]
        Metadata[Metadata]
        Search[Search Engine]
    end

    subgraph Integration_Layer
        Vectorizer[Text Vectorizer]
        IndexService[Indexing Service]
        SearchService[Search Service]
    end

    Content --> Vectorizer
    Vectorizer --> Vectors
    Vectors --> Tables
    Tables --> LanceDB
    Search --> SearchService
    SearchService --> LanceDB
    Metadata --> IndexService
    IndexService --> Content
```

### 8.2 Knowledge Base Components
```mermaid
erDiagram
    KnowledgeBase ||--o{ ContentVersion : has
    KnowledgeBase ||--o{ Tag : tagged_with
    KnowledgeBase ||--o{ Category : belongs_to
    KnowledgeBase ||--o{ VectorEmbedding : embedded_as
    
    KnowledgeBase {
        string id
        string title
        string content
        string type
        json metadata
        datetime createdAt
        datetime updatedAt
    }
    
    VectorEmbedding {
        string id
        array vector
        string contentId
        datetime createdAt
    }
    
    ContentVersion {
        string id
        string content
        datetime createdAt
        string createdBy
    }
```

### 8.3 Search Flow Architecture
```mermaid
sequenceDiagram
    participant User
    participant API
    participant Vectorizer
    participant LanceDB
    participant PostgreSQL

    User->>API: Search Query
    API->>Vectorizer: Vectorize Query
    Vectorizer-->>API: Query Vector
    API->>LanceDB: Vector Similarity Search
    LanceDB-->>API: Similar Document IDs
    API->>PostgreSQL: Fetch Full Documents
    PostgreSQL-->>API: Document Details
    API-->>User: Search Results
```

### 8.4 Content Indexing Flow
```mermaid
sequenceDiagram
    participant Content Creator
    participant API
    participant Vectorizer
    participant LanceDB
    participant PostgreSQL

    Content Creator->>API: Submit Content
    API->>PostgreSQL: Store Content
    PostgreSQL-->>API: Content ID
    API->>Vectorizer: Generate Embeddings
    Vectorizer-->>API: Content Vectors
    API->>LanceDB: Store Vectors
    API-->>Content Creator: Confirmation
```

### 8.5 Knowledge Base Features

1. **Content Types**
   - Course Materials
   - Lesson Plans
   - Assessments
   - Resources
   - FAQs
   - Documentation

2. **Search Capabilities**
   - Semantic Search
   - Keyword Search
   - Category-based Search
   - Tag-based Filtering
   - Relevance Scoring

3. **Content Management**
   - Version Control
   - Metadata Management
   - Content Categorization
   - Access Control
   - Content Validation

4. **Integration Points**
   - Course Management
   - Learning Paths
   - Assessment System
   - Resource Library
   - User Dashboard

### 8.6 Performance Considerations

1. **Vector Storage Optimization**
   - Dimensionality Reduction
   - Clustering
   - Index Optimization
   - Batch Processing

2. **Search Performance**
   - Vector Caching
   - Result Caching
   - Query Optimization
   - Parallel Processing

3. **Content Delivery**
   - CDN Integration
   - Content Compression
   - Lazy Loading
   - Progressive Loading

4. **Scalability**
   - Horizontal Scaling
   - Sharding
   - Load Balancing
   - Replication

## 9. Scalability Considerations

### 9.1 Horizontal Scaling
```mermaid
graph TB
    subgraph Load_Balancer
        LB[Load Balancer]
    end

    subgraph Application_Tier
        App1[Instance 1]
        App2[Instance 2]
        App3[Instance N]
    end

    subgraph Database_Tier
        DB1[Shard 1]
        DB2[Shard 2]
        DB3[Shard N]
    end

    LB --> App1
    LB --> App2
    LB --> App3
    App1 --> DB1
    App2 --> DB2
    App3 --> DB3
```

### 9.2 Vertical Scaling
- Database optimization
- Cache optimization
- Query optimization

## 10. Integration Points

### 10.1 External Systems
```mermaid
graph LR
    LMS[Learning Platform]
    SMS[Student Management]
    CMS[Content Management]
    NMS[Notification System]

    LMS --- SMS
    LMS --- CMS
    LMS --- NMS
```

### 10.2 API Architecture
- TRPC APIs
- 
- Webhook integration
- Event-driven architecture

## 11. Monitoring and Analytics

### 11.1 System Monitoring
```mermaid
graph TB
    subgraph Monitoring
        Metrics[Metrics Collection]
        Logs[Log Aggregation]
        Alerts[Alert System]
    end

    subgraph Analytics
        Usage[Usage Analytics]
        Performance[Performance Analytics]
        Business[Business Intelligence]
    end

    Monitoring --> Analytics
```

### 11.2 Key Metrics
- System performance
- User engagement
- Learning outcomes
- Resource utilization

## 12. Deployment Architecture

### 12.1 Infrastructure
```mermaid
graph TB
    subgraph Cloud_Infrastructure
        LB[Load Balancer]
        App[Application Servers]
        Cache[Cache Servers]
        DB[Database Clusters]
    end

    subgraph Services
        Web[Web Services]
        API[API Services]
        Worker[Background Workers]
    end

    LB --> App
    App --> Cache
    App --> DB
    App --> Services
```

### 12.2 Deployment Strategy
- Continuous Integration/Deployment
- Blue-Green deployment
- Canary releases
- Rolling updates 