-- CreateEnum
CREATE TYPE "FlowRunStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "FlowDefinition" (
    "flowId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definitionJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowDefinition_pkey" PRIMARY KEY ("flowId","version")
);

-- CreateTable
CREATE TABLE "FlowRun" (
    "runId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersion" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" "FlowRunStatus" NOT NULL,
    "currentNodeId" TEXT,
    "inputJson" JSONB NOT NULL,
    "stateJson" JSONB NOT NULL,
    "outputsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowRun_pkey" PRIMARY KEY ("runId")
);

-- CreateTable
CREATE TABLE "FlowRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "nodeId" TEXT,
    "attempt" INTEGER,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "FlowRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowIdempotency" (
    "key" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "outputJson" JSONB,
    "patchJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowIdempotency_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "FlowRun_flowId_flowVersion_idx" ON "FlowRun"("flowId", "flowVersion");

-- CreateIndex
CREATE INDEX "FlowRun_tenantId_idx" ON "FlowRun"("tenantId");

-- CreateIndex
CREATE INDEX "FlowRun_status_idx" ON "FlowRun"("status");

-- CreateIndex
CREATE INDEX "FlowRunEvent_runId_idx" ON "FlowRunEvent"("runId");

-- CreateIndex
CREATE INDEX "FlowRunEvent_runId_at_idx" ON "FlowRunEvent"("runId", "at");

-- CreateIndex
CREATE INDEX "FlowIdempotency_runId_idx" ON "FlowIdempotency"("runId");
