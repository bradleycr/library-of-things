import { NextResponse } from "next/server"
import {
  listBooks,
  listLoanEvents,
  listNodes,
  listUsers,
} from "@/lib/server/repositories"

export async function GET() {
  const [books, loanEvents, nodes, users] = await Promise.all([
    listBooks(),
    listLoanEvents(),
    listNodes(),
    listUsers(),
  ])

  return NextResponse.json({
    books,
    loanEvents,
    nodes,
    users,
  })
}
