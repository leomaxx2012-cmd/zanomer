export function listingSellerName(listing: {isSiteListing?:boolean;ownerId?:string;seller?:string}, userId: string, profileName: string) {
  if(listing.isSiteListing && userId && listing.ownerId===userId && profileName.trim()) return profileName.trim();
  return listing.seller?.trim() || "Пользователь ЗаНомером";
}
