"use client"

import Link from "next/link"
import {
  BookOpen,
  AlertTriangle,
  TrendingUp,
  PlusCircle,
  Edit,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { mockBooks, mockLoanEvents, mockNodes } from "@/lib/mock-data"

// Steward manages node n1 (Foresight Berlin Flybrary)
const stewardNode = mockNodes[0]
const nodeBooks = mockBooks.filter(
  (b) => b.current_node_id === stewardNode.id || b.current_holder_id
)

const checkedOut = mockBooks.filter(
  (b) => b.availability_status === "checked_out"
).length
const overdueBooks = mockBooks.filter((b) => {
  if (!b.expected_return_date) return false
  return new Date(b.expected_return_date) < new Date()
}).length

// Most borrowed books (count events per book)
const bookEventCounts = mockLoanEvents.reduce(
  (acc, e) => {
    if (e.event_type === "checkout") {
      acc[e.book_title || ""] = (acc[e.book_title || ""] || 0) + 1
    }
    return acc
  },
  {} as Record<string, number>
)

const mostBorrowedData = Object.entries(bookEventCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 6)
  .map(([name, count]) => ({
    name: name.length > 18 ? `${name.slice(0, 18)}...` : name,
    checkouts: count,
  }))

// Loan activity over time (by month)
const activityByMonth = mockLoanEvents.reduce(
  (acc, e) => {
    const month = new Date(e.timestamp).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    })
    acc[month] = (acc[month] || 0) + 1
    return acc
  },
  {} as Record<string, number>
)

const activityData = Object.entries(activityByMonth)
  .map(([month, events]) => ({ month, events }))
  .reverse()

export default function StewardDashboardPage() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Steward Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Managing: {stewardNode.name}
            </p>
          </div>
          <Link href="/steward/add-book">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Add New Book
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {mockBooks.length}
              </span>
              <span className="text-xs text-muted-foreground">Total Books</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <TrendingUp className="h-5 w-5 text-accent" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {checkedOut}
              </span>
              <span className="text-xs text-muted-foreground">Checked Out</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {overdueBooks}
              </span>
              <span className="text-xs text-muted-foreground">Overdue</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {mockBooks.length - checkedOut}
              </span>
              <span className="text-xs text-muted-foreground">Available</span>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Most Borrowed */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Most Borrowed Books
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mostBorrowedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Bar
                    dataKey="checkouts"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Loan Activity */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Loan Activity Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="events"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Book Management Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Book Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockBooks.slice(0, 15).map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        <Link
                          href={`/book/${book.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {book.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {book.author || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            book.availability_status === "available"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            book.availability_status === "available"
                              ? "bg-accent text-accent-foreground"
                              : ""
                          }
                        >
                          {book.availability_status === "available"
                            ? "Available"
                            : "Checked Out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {book.current_node_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground"
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
