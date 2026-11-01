export type ChatMessage = {id:string;listing_id?:string;sender_id:string;recipient_id:string;body:string;created_at:string};
export type ChatThread = {listingId:string;partnerId:string;lastMessage:ChatMessage};

export function belongsToConversation(message:ChatMessage,listingId:string,userId:string,partnerId:string) {
 return message.listing_id===listingId&&!!userId&&!!partnerId&&userId!==partnerId&&(
  (message.sender_id===userId&&message.recipient_id===partnerId)||
  (message.sender_id===partnerId&&message.recipient_id===userId));
}

export function groupChatThreads(messages:ChatMessage[],userId:string):ChatThread[] {
 const threads=new Map<string,ChatThread>();
 for(const message of messages) {
  if(!userId||!message.listing_id||![message.sender_id,message.recipient_id].includes(userId))continue;
  const partnerId=message.sender_id===userId?message.recipient_id:message.sender_id;
  if(!partnerId||partnerId===userId)continue;
  const key=`${message.listing_id}:${partnerId}`;
  const previous=threads.get(key);
  if(!previous||previous.lastMessage.created_at<message.created_at)threads.set(key,{listingId:message.listing_id,partnerId,lastMessage:message});
 }
 return [...threads.values()].sort((a,b)=>b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
}
