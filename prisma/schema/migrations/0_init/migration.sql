-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'USER', 'ANON');

-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('ADMIN', 'EDITOR', 'REVIEWER', 'AUTHOR');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'REJECTED', 'APPROVED', 'PUBLISHED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "SubmissionActivityType" AS ENUM ('NEW_SUBMISSION', 'SUBMISSION_KIND_CHANGE', 'VERSION_ADDED', 'VERSION_STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CHECK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "system_role" "SystemRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "doi" TEXT,
    "submitted_by_id" TEXT NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkVersion" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "cdn" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authors" TEXT[],
    "date" TEXT,
    "doi" TEXT,
    "canonical" BOOLEAN,
    "work_id" TEXT NOT NULL,

    CONSTRAINT "WorkVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteUser" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "role" "SiteRole" NOT NULL DEFAULT 'AUTHOR',
    "site_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "SiteUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "submission_cdn" TEXT NOT NULL DEFAULT 'https://prv.curvenote.com',
    "description" TEXT,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionKind" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checks" JSONB[],
    "site_id" TEXT NOT NULL,

    CONSTRAINT "SubmissionKind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionActivity" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "activity_by_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "activity_type" "SubmissionActivityType" NOT NULL,
    "submission_version_id" TEXT,
    "status" "SubmissionStatus" DEFAULT 'PENDING',
    "work_version_id" TEXT,
    "kind_id" TEXT,

    CONSTRAINT "SubmissionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersion" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "work_version_id" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,

    CONSTRAINT "SubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "kind_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "handshake" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "results" JSONB,
    "messages" TEXT[],

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkVersion" ADD CONSTRAINT "WorkVersion_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteUser" ADD CONSTRAINT "SiteUser_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteUser" ADD CONSTRAINT "SiteUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionKind" ADD CONSTRAINT "SubmissionKind_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_activity_by_id_fkey" FOREIGN KEY ("activity_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_submission_version_id_fkey" FOREIGN KEY ("submission_version_id") REFERENCES "SubmissionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_work_version_id_fkey" FOREIGN KEY ("work_version_id") REFERENCES "WorkVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_kind_id_fkey" FOREIGN KEY ("kind_id") REFERENCES "SubmissionKind"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_work_version_id_fkey" FOREIGN KEY ("work_version_id") REFERENCES "WorkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_kind_id_fkey" FOREIGN KEY ("kind_id") REFERENCES "SubmissionKind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

