ALTER TABLE "AttendanceSession"
    ADD COLUMN "qrOpenedAt" TIMESTAMP(3),
    ADD COLUMN "qrClosesAt" TIMESTAMP(3),
    ADD COLUMN "qrLateAt" TIMESTAMP(3),
    ADD COLUMN "qrFinalizedAt" TIMESTAMP(3);

CREATE INDEX "AttendanceSession_qrClosesAt_idx" ON "AttendanceSession"("qrClosesAt");

CREATE TABLE "SmartAttendanceCheckIn" (
    "attendanceSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ticketHash" TEXT,
    "ticketExpiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "reviewStatus" "AttendanceStatus",
    "reviewNote" TEXT,
    CONSTRAINT "SmartAttendanceCheckIn_pkey" PRIMARY KEY ("attendanceSessionId", "studentId"),
    CONSTRAINT "SmartAttendanceCheckIn_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartAttendanceCheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SmartAttendanceCheckIn_ticketHash_key" ON "SmartAttendanceCheckIn"("ticketHash");
CREATE INDEX "SmartAttendanceCheckIn_studentId_idx" ON "SmartAttendanceCheckIn"("studentId");
