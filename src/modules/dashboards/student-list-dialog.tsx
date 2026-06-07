"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/modules/dashboards/components"

type StudentListDialogProps = {
  count: number
  students: {
    email: string
    id: string
    name: string
    status: string
  }[]
}

export function StudentListDialog({ count, students }: StudentListDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="block w-full text-left"
          type="button"
        >
          <Card className="lms-card lms-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Students
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold">{count}</div>
              <p className="text-xs text-primary">View student list</p>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enrolled students</DialogTitle>
          <DialogDescription>
            Students currently enrolled in this class section.
          </DialogDescription>
        </DialogHeader>
        {students.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>
                      <StatusBadge value={student.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No students are enrolled in this class yet.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
