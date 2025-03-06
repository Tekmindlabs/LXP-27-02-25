# Learning Experience Platform - Implementation Plan

## 1. Foundation Layer (Week 1-2)

### 1.1 Project Setup
```bash
# Initialize Next.js project with TypeScript and Tailwind
npx create-next-app@latest lxp-platform --typescript --tailwind --eslint

# Install core dependencies
npm install @trpc/server @trpc/client @trpc/react-query @prisma/client zod
npm install @shadcn/ui @radix-ui/react-* class-variance-authority
npm install @tanstack/react-query next-auth prisma superjson

# Install Vector Database and ML dependencies
npm install lancedb @lancedb/vectorizer
npm install @xenova/transformers
npm install natural compromise
```

### 1.2 Database Infrastructure
```bash
# Initialize Prisma with PostgreSQL
npx prisma init --datasource-provider postgresql

# Configure database connection
DATABASE_URL="postgresql://user:password@localhost:5432/lxp_db?schema=public"

# Create initial schema
prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "filteredRelationCount"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# Core models implementation
model Institution {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  campuses    Campus[]
  programs    Program[]
  // ... other fields
}

# Run initial migration
npx prisma migrate dev --name init
```

### 1.3 Project Structure
```typescript
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (admin)/           # Admin portal
│   ├── (coordinator)/     # Coordinator portal
│   ├── (campus)/          # Campus portal
│   ├── (teacher)/         # Teacher portal
│   └── (student)/         # Student portal
├── components/            
│   ├── ui/                # ShadCN UI components
│   ├── forms/             # Form components
│   └── layouts/           # Layout components
├── server/               
│   ├── api/               # API routes
│   ├── db/                # Database utilities
│   └── trpc/              # tRPC setup
└── lib/                   # Utilities
```

## 2. Core Services Layer (Week 3-4)

### 2.1 Authentication System with NextAuth.js
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/server/db/client'
import Credentials from 'next-auth/providers/credentials'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const authService = new AuthService(prisma)
        return authService.authenticateUser(credentials.email, credentials.password)
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: user.role,
          permissions: user.permissions
        }
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    signOut: '/auth/signout'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

// src/lib/auth/session.ts
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function getAuthSession() {
  return await getServerSession(authOptions)
}

// src/components/auth/auth-provider.tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}

// src/app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

// src/middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      // Implement role-based route protection
      const path = req.nextUrl.pathname
      
      if (path.startsWith('/admin')) {
        return token?.role === 'ADMIN'
      }
      
      if (path.startsWith('/coordinator')) {
        return token?.role === 'COORDINATOR'
      }

      if (path.startsWith('/campus')) {
        return token?.role === 'CAMPUS_ADMIN'
      }
      
      if (path.startsWith('/teacher')) {
        return token?.role === 'TEACHER'
      }
      
      if (path.startsWith('/student')) {
        return token?.role === 'STUDENT'
      }
      
      return !!token
    }
  }
})

export const config = {
  matcher: [
    '/admin/:path*',
    '/coordinator/:path*',
    '/campus/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/api/trpc/:path*'
  ]
}

// src/hooks/use-auth.ts
import { useSession, signIn, signOut } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()
  
  const login = async (email: string, password: string) => {
    return signIn('credentials', {
      email,
      password,
      redirect: false
    })
  }
  
  const logout = () => signOut()
  
  return {
    user: session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    login,
    logout
  }
}

// src/components/auth/login-form.tsx
'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  })
  
  const onSubmit = async (data: LoginFormData) => {
    const result = await login(data.email, data.password)
    
    if (result?.error) {
      form.setError('root', { message: 'Invalid credentials' })
    } else {
      router.push('/dashboard')
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="email"
          label="Email"
          control={form.control}
          render={({ field }) => (
            <Input type="email" {...field} />
          )}
        />
        <FormField
          name="password"
          label="Password"
          control={form.control}
          render={({ field }) => (
            <Input type="password" {...field} />
          )}
        />
        <Button type="submit">Sign In</Button>
      </form>
    </Form>
  )
}
```

### 2.2 Base Service Layer
```typescript
// src/server/services/base.service.ts
export abstract class BaseService<T> {
  constructor(protected prisma: PrismaClient) {}

  protected abstract get model(): string

  async findMany(args?: Prisma.Args<T, 'findMany'>) {
    return this.prisma[this.model].findMany(args)
  }

  async findUnique(args: Prisma.Args<T, 'findUnique'>) {
    return this.prisma[this.model].findUnique(args)
  }

  async create(args: Prisma.Args<T, 'create'>) {
    return this.prisma[this.model].create(args)
  }
}

// Example implementation
export class InstitutionService extends BaseService<Institution> {
  protected get model() { return 'institution' }

  async getFullDetails(id: string) {
    return this.prisma.institution.findUnique({
      where: { id },
      include: {
        campuses: true,
        programs: {
          include: {
            courses: true,
            curriculum: true
          }
        }
      }
    })
  }
}
```

## 3. UI Foundation Layer (Week 5-6)

### 3.1 Responsive Layout System
```typescript
// src/components/layouts/responsive-container.tsx
export const ResponsiveContainer = ({
  children,
  className,
  maxWidth = '7xl'
}: ResponsiveContainerProps) => {
  return (
    <div className={cn(
      "w-full px-4 mx-auto",
      `max-w-${maxWidth}`,
      "sm:px-6 lg:px-8",
      className
    )}>
      {children}
    </div>
  )
}

// src/components/layouts/dashboard-layout.tsx
export const DashboardLayout = ({
  sidebar,
  header,
  children
}: DashboardLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Mobile sidebar */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            {sidebar}
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-72 lg:flex-col">
          {sidebar}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background">
            {header}
          </header>
          <main className="flex-1">
            <ResponsiveContainer>
              {children}
            </ResponsiveContainer>
          </main>
        </div>
      </div>
    </div>
  )
}
```

### 3.2 Form Components
```typescript
// src/components/forms/form-field.tsx
export const FormField = <T extends FieldValues>({
  name,
  label,
  control,
  render,
  description
}: FormFieldProps<T>) => {
  return (
    <FormProvider {...form}>
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState: { error } }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {render({ field, error })}
            {description && (
              <FormDescription>{description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </FormProvider>
  )
}

// Usage example
export const InstitutionForm = () => {
  const form = useForm<InstitutionFormData>({
    resolver: zodResolver(institutionSchema)
  })

  return (
    <Form {...form}>
      <FormField
        name="name"
        label="Institution Name"
        control={form.control}
        render={({ field }) => (
          <Input {...field} placeholder="Enter institution name" />
        )}
      />
    </Form>
  )
}
```

## 4. Feature Implementation Layer (Week 7-10)

### 4.1 Institution Management
```typescript
// src/features/institution/institution.service.ts
export class InstitutionService extends BaseService<Institution> {
  async createInstitution(data: CreateInstitutionInput) {
    return this.prisma.institution.create({
      data: {
        ...data,
        settings: this.getDefaultSettings(),
        status: 'ACTIVE'
      }
    })
  }

  async addCampus(institutionId: string, data: CreateCampusInput) {
    return this.prisma.campus.create({
      data: {
        ...data,
        institutionId
      }
    })
  }
}

// src/features/institution/components/institution-dashboard.tsx
export const InstitutionDashboard = () => {
  const { data: stats } = api.institution.getStats.useQuery()
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution Overview"
        actions={
          <Button asChild>
            <Link href="/admin/institution/settings">
              Manage Settings
            </Link>
          </Button>
        }
      />
      
      <StatGrid>
        <StatCard
          title="Total Students"
          value={stats?.studentCount}
          change={stats?.studentGrowth}
        />
        <StatCard
          title="Active Programs"
          value={stats?.programCount}
        />
        {/* More stats */}
      </StatGrid>
      
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="campuses">Campuses</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <InstitutionOverview />
        </TabsContent>
        {/* Other tab contents */}
      </Tabs>
    </div>
  )
}
```

### 4.2 Academic Management
```typescript
// src/features/academic/program.service.ts
export class ProgramService extends BaseService<Program> {
  async createProgram(data: CreateProgramInput) {
    return this.prisma.program.create({
      data: {
        ...data,
        curriculum: {
          create: this.generateDefaultCurriculum(data)
        }
      }
    })
  }

  async assignTeachers(programId: string, teacherIds: string[]) {
    return this.prisma.programTeacher.createMany({
      data: teacherIds.map(teacherId => ({
        programId,
        teacherId
      }))
    })
  }
}

// src/features/academic/components/program-dashboard.tsx
export const ProgramDashboard = () => {
  const { data: program } = api.program.getDetails.useQuery()
  
  return (
    <div className="space-y-6">
      <ProgramHeader program={program} />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ProgramStats stats={program?.stats} />
        <EnrollmentChart data={program?.enrollmentTrend} />
        <PerformanceMetrics data={program?.performance} />
      </div>
      
      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>
        <TabsContent value="courses">
          <CourseList
            courses={program?.courses}
            onAddCourse={handleAddCourse}
          />
        </TabsContent>
        {/* Other tab contents */}
      </Tabs>
    </div>
  )
}
```

## 5. Mobile Optimization Layer (Week 11)

### 5.1 Touch-Friendly Components
```typescript
// src/components/mobile/swipe-list.tsx
export const SwipeList = <T,>({
  items,
  renderItem,
  actions
}: SwipeListProps<T>) => {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <SwipeActions
          key={index}
          actions={actions.map(action => ({
            ...action,
            onClick: () => action.onClick(item)
          }))}
        >
          {renderItem(item)}
        </SwipeActions>
      ))}
    </div>
  )
}

// Usage example
<SwipeList
  items={students}
  renderItem={(student) => (
    <StudentCard student={student} />
  )}
  actions={[
    {
      label: 'Mark Present',
      onClick: (student) => markAttendance(student.id, 'PRESENT')
    },
    {
      label: 'Mark Absent',
      onClick: (student) => markAttendance(student.id, 'ABSENT')
    }
  ]}
/>
```

### 5.2 Responsive Data Visualization
```typescript
// src/components/charts/responsive-chart.tsx
export const ResponsiveChart = ({
  data,
  type = 'bar'
}: ResponsiveChartProps) => {
  const [width, setWidth] = useState(0)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })

    if (chartRef.current) {
      resizeObserver.observe(chartRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div ref={chartRef} className="w-full">
      <Chart
        type={type}
        data={data}
        width={width}
        height={width * 0.6}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          // ... other options
        }}
      />
    </div>
  )
}
```

## 6. Performance Optimization Layer (Week 12)

### 6.1 Data Caching Strategy
```typescript
// src/lib/cache/cache-config.ts
export const CACHE_CONFIG = {
  institution: {
    ttl: 60 * 5, // 5 minutes
    staleTime: 30 * 1000 // 30 seconds
  },
  program: {
    ttl: 60 * 15, // 15 minutes
    staleTime: 60 * 1000 // 1 minute
  }
}

// src/server/trpc/middleware/cache.ts
export const withCache = t.middleware(async ({ ctx, next, path }) => {
  const cacheKey = `trpc:${path}`
  const cached = await ctx.redis.get(cacheKey)

  if (cached) {
    return JSON.parse(cached)
  }

  const result = await next()
  
  if (result.ok) {
    const config = CACHE_CONFIG[path.split('.')[0]]
    await ctx.redis.setex(cacheKey, config.ttl, JSON.stringify(result))
  }

  return result
})
```

### 6.2 Query Optimization
```typescript
// src/server/db/middleware/query-logger.ts
export const queryLogger: Prisma.Middleware = async (params, next) => {
  const start = performance.now()
  const result = await next(params)
  const end = performance.now()
  
  console.log(`Query ${params.model}.${params.action} took ${end - start}ms`)
  
  return result
}

// src/server/db/client.ts
export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findMany({ model, operation, args, query }) {
        // Add query optimization hints
        args.orderBy = args.orderBy ?? { id: 'desc' }
        
        if (!args.take && !args.skip) {
          args.take = 50 // Default pagination
        }
        
        return query(args)
      }
    }
  }
})
```

## 7. Vector Database and Knowledge Base Layer (Week 13-14)

### 7.1 Vector Database Setup
```typescript
// src/server/db/vector/lance-client.ts
import { connect } from 'lancedb'
import { Vectorizer } from '@lancedb/vectorizer'

export class VectorDBClient {
  private db: any
  private vectorizer: Vectorizer

  constructor() {
    this.initializeDB()
    this.vectorizer = new Vectorizer()
  }

  private async initializeDB() {
    this.db = await connect('data/vectors')
  }

  async createTable(name: string, schema: any) {
    return await this.db.createTable(name, schema)
  }

  async vectorize(text: string) {
    return await this.vectorizer.vectorize(text)
  }

  async search(table: string, query: string, limit = 5) {
    const queryVector = await this.vectorize(query)
    const tbl = await this.db.openTable(table)
    return await tbl.search(queryVector).limit(limit).execute()
  }
}

// src/server/services/knowledge-base.service.ts
export class KnowledgeBaseService {
  constructor(
    private vectorDB: VectorDBClient,
    private prisma: PrismaClient
  ) {}

  async indexContent(content: KnowledgeContent) {
    const vector = await this.vectorDB.vectorize(content.text)
    
    // Store in PostgreSQL
    const record = await this.prisma.knowledgeBase.create({
      data: {
        title: content.title,
        content: content.text,
        type: content.type,
        metadata: content.metadata
      }
    })

    // Store in LanceDB
    const table = await this.vectorDB.getTable('knowledge')
    await table.add([{
      id: record.id,
      vector,
      text: content.text,
      metadata: content.metadata
    }])

    return record
  }

  async semanticSearch(query: string) {
    const results = await this.vectorDB.search('knowledge', query)
    
    // Fetch full details from PostgreSQL
    const ids = results.map(r => r.id)
    return await this.prisma.knowledgeBase.findMany({
      where: { id: { in: ids } }
    })
  }
}

// src/server/db/schema/knowledge.schema.ts
export interface KnowledgeContent {
  title: string
  text: string
  type: KnowledgeType
  metadata: Record<string, any>
}

export enum KnowledgeType {
  COURSE_MATERIAL = 'COURSE_MATERIAL',
  LESSON_PLAN = 'LESSON_PLAN',
  ASSESSMENT = 'ASSESSMENT',
  RESOURCE = 'RESOURCE',
  FAQ = 'FAQ'
}

// prisma/schema.prisma additions
model KnowledgeBase {
  id        String   @id @default(cuid())
  title     String
  content   String   @db.Text
  type      String
  metadata  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 7.2 Knowledge Base Components
```typescript
// src/components/knowledge/search-interface.tsx
export const KnowledgeSearch = () => {
  const [query, setQuery] = useState('')
  const { data: results, isLoading } = api.knowledge.search.useQuery(
    { query },
    { enabled: query.length > 2 }
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge base..."
          className="w-full"
        />
        {isLoading && (
          <Spinner className="absolute right-3 top-3" />
        )}
      </div>

      <div className="space-y-4">
        {results?.map((result) => (
          <KnowledgeCard
            key={result.id}
            item={result}
          />
        ))}
      </div>
    </div>
  )
}

// src/components/knowledge/knowledge-card.tsx
export const KnowledgeCard = ({
  item
}: {
  item: KnowledgeBase
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{item.title}</CardTitle>
        <CardDescription>
          {item.type}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose dark:prose-invert">
          {item.content}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 7.3 Knowledge Base API
```typescript
// src/server/trpc/routers/knowledge.ts
export const knowledgeRouter = createTRPCRouter({
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(3)
    }))
    .query(async ({ ctx, input }) => {
      const service = new KnowledgeBaseService(
        ctx.vectorDB,
        ctx.prisma
      )
      return service.semanticSearch(input.query)
    }),

  index: protectedProcedure
    .input(knowledgeContentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new KnowledgeBaseService(
        ctx.vectorDB,
        ctx.prisma
      )
      return service.indexContent(input)
    })
})

// src/server/trpc/context.ts
export const createContext = async (opts: CreateNextContextOptions) => {
  const vectorDB = new VectorDBClient()
  
  return {
    ...existingContext,
    vectorDB
  }
}
```

This implementation provides:
1. Vector database integration with LanceDB
2. Knowledge base storage and retrieval
3. Semantic search capabilities
4. Type-safe API endpoints
5. Reusable UI components
6. Efficient data storage using both PostgreSQL and vector database

The knowledge base system allows for:
- Semantic search across educational content
- Storage of various types of educational materials
- Fast retrieval using vector similarity
- Structured metadata storage
- Type-safe content management

This implementation plan provides:
1. Clear separation of concerns
2. Progressive enhancement
3. Mobile-first approach
4. Type safety throughout
5. Performance optimization
6. Scalable architecture

Would you like me to elaborate on any specific aspect? 

// src/lib/auth/types.ts
export type UserRole = 
  | 'ADMIN'
  | 'COORDINATOR'
  | 'CAMPUS_ADMIN'
  | 'TEACHER'
  | 'STUDENT'

export interface UserPermissions {
  canManageInstitution?: boolean
  canManageCampus?: boolean
  canManagePrograms?: boolean
  canManageClasses?: boolean
  canManageAttendance?: boolean
  canViewReports?: boolean
  canManageUsers?: boolean
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  permissions: UserPermissions
  campusId?: string  // For campus-specific roles
  institutionId: string
}

// src/lib/auth/permissions.ts
export const rolePermissions: Record<UserRole, UserPermissions> = {
  ADMIN: {
    canManageInstitution: true,
    canManageCampus: true,
    canManagePrograms: true,
    canManageClasses: true,
    canManageAttendance: true,
    canViewReports: true,
    canManageUsers: true
  },
  COORDINATOR: {
    canManagePrograms: true,
    canManageClasses: true,
    canManageAttendance: true,
    canViewReports: true
  },
  CAMPUS_ADMIN: {
    canManageCampus: true,
    canManageClasses: true,
    canManageAttendance: true,
    canViewReports: true,
    canManageUsers: true
  },
  TEACHER: {
    canManageClasses: true,
    canManageAttendance: true,
    canViewReports: true
  },
  STUDENT: {
    canViewReports: true
  }
} 