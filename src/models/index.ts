// Model registry: importing this module registers every model with Mongoose, so tooling such as
// `npm run db:sync-indexes` can enumerate them via mongoose.modelNames().
// Add an import here whenever a model file is created.

import "@/models/analyticsCounter.model";
import "@/models/emailLog.model";
import "@/models/event.model";
import "@/models/expense.model";
import "@/models/gallery.model";
import "@/models/galleryAccessToken.model";
import "@/models/galleryAlbum.model";
import "@/models/galleryAsset.model";
import "@/models/guest.model";
import "@/models/guestGroup.model";
import "@/models/liveStream.model";
import "@/models/passwordResetToken.model";
import "@/models/rateLimitCounter.model";
import "@/models/rsvp.model";
import "@/models/session.model";
import "@/models/task.model";
import "@/models/user.model";
import "@/models/vendor.model";
import "@/models/vendorPayment.model";
import "@/models/wedding.model";
import "@/models/weddingInvitation.model";
import "@/models/weddingMember.model";
import "@/models/weddingWebsite.model";
