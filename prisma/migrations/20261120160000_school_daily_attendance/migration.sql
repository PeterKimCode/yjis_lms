CREATE TABLE "SchoolAttendanceSchedule" (
    "scopeKey" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "campusId" TEXT REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "opensMinute" INTEGER NOT NULL,
    "lateMinute" INTEGER NOT NULL,
    "closesMinute" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "closedDates" TEXT[],
    CONSTRAINT "SchoolAttendanceSchedule_order_check" CHECK (0 <= "opensMinute" AND "opensMinute" <= "lateMinute" AND "lateMinute" < "closesMinute" AND "closesMinute" < 1440)
);

CREATE INDEX "SchoolAttendanceSchedule_organizationId_idx" ON "SchoolAttendanceSchedule"("organizationId");
CREATE INDEX "SchoolAttendanceSchedule_campusId_idx" ON "SchoolAttendanceSchedule"("campusId");

CREATE TABLE "SchoolAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "campusId" TEXT REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "studentId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "schoolDate" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "checkedInAt" TIMESTAMP(3),
    "note" TEXT,
    "updatedById" TEXT,
    "ticketHash" TEXT,
    "ticketExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolAttendanceRecord_status_check" CHECK ("status" IN ('PENDING','PRESENT','LATE','ABSENT','EXCUSED'))
);

CREATE UNIQUE INDEX "SchoolAttendanceRecord_organizationId_studentId_schoolDate_key" ON "SchoolAttendanceRecord"("organizationId", "studentId", "schoolDate");
CREATE UNIQUE INDEX "SchoolAttendanceRecord_ticketHash_key" ON "SchoolAttendanceRecord"("ticketHash");
CREATE INDEX "SchoolAttendanceRecord_organizationId_schoolDate_campusId_idx" ON "SchoolAttendanceRecord"("organizationId", "schoolDate", "campusId");
CREATE INDEX "SchoolAttendanceRecord_campusId_idx" ON "SchoolAttendanceRecord"("campusId");
CREATE INDEX "SchoolAttendanceRecord_studentId_idx" ON "SchoolAttendanceRecord"("studentId");
