// Model registry: importing this module registers every model with Mongoose, so tooling such as
// `npm run db:sync-indexes` can enumerate them via mongoose.modelNames().
// Add an import here whenever a model file is created.

import "@/models/emailLog.model";
import "@/models/event.model";
import "@/models/passwordResetToken.model";
import "@/models/rateLimitCounter.model";
import "@/models/session.model";
import "@/models/user.model";
import "@/models/wedding.model";
import "@/models/weddingInvitation.model";
import "@/models/weddingMember.model";
