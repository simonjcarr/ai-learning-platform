import { prisma } from '../src/lib/prisma';

async function deleteUser(clerkUserId: string) {
  try {
    console.log(`🗑️  Deleting user ${clerkUserId} and all related data...\n`);

    // Delete in order of dependencies
    
    // 1. Delete chat messages
    const deletedChats = await prisma.chatMessage.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedChats.count} chat messages`);

    // 2. Delete user responses
    const deletedResponses = await prisma.userResponse.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedResponses.count} user responses`);

    // 3. Delete comments (including replies)
    const deletedComments = await prisma.comment.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedComments.count} comments`);

    // 4. Delete article likes
    const deletedLikes = await prisma.articleLike.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedLikes.count} article likes`);

    // 5. Delete curated list items first, then lists
    const userLists = await prisma.curatedList.findMany({
      where: { clerkUserId },
      select: { listId: true },
    });
    
    for (const list of userLists) {
      await prisma.curatedListItem.deleteMany({
        where: { listId: list.listId },
      });
    }
    
    const deletedLists = await prisma.curatedList.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedLists.count} curated lists`);

    // 6. Delete subscription history
    const deletedSubHistory = await prisma.subscriptionHistory.deleteMany({
      where: { clerkUserId },
    });
    console.log(`✅ Deleted ${deletedSubHistory.count} subscription history records`);

    // 7. Delete articles created by the user
    const deletedArticles = await prisma.article.deleteMany({
      where: { createdByClerkUserId: clerkUserId },
    });
    console.log(`✅ Deleted ${deletedArticles.count} articles`);

    // 8. Finally, delete the user
    const deletedUser = await prisma.user.delete({
      where: { clerkUserId },
    });
    console.log(`\n✅ Successfully deleted user: ${deletedUser.email}`);

  } catch (error) {
    console.error('❌ Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get the user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a Clerk user ID as an argument');
  console.log('Usage: npm run delete-user <clerkUserId>');
  process.exit(1);
}

deleteUser(userId);