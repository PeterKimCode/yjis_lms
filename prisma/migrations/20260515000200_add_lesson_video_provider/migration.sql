-- Add explicit provider selection for lesson videos.
CREATE TYPE "VideoProvider" AS ENUM ('HTML5', 'YOUTUBE');

ALTER TABLE "Lesson" ADD COLUMN "videoProvider" "VideoProvider" NOT NULL DEFAULT 'HTML5';
