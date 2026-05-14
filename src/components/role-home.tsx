import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/modules/auth/session"

export async function RoleHome({ title }: { title: string }) {
  const session = await requireAuth()

  return (
    <main className="flex-1 bg-muted/40 px-4 py-10">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{session.user.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.user.roleAssignments.map((assignment) => (
                <Badge key={assignment.role} variant="outline">
                  {assignment.role}
                </Badge>
              ))}
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
