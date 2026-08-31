import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications } from "../lib/push-notifications";

type Plate = {
  id: string;
  value: string;
  leftLetter: string;
  rightLetters: string;
  digits: string;
  region: string;
  price: string;
  priceValue: number;
  vehicle: "car" | "motorcycle" | "truck";
  seller: string;
  createdAt: string;
  publishedAt?: string;
  tag: string;
  sourceName?: string;
  sourceUrl?: string;
  isSiteListing?: boolean;
  sellerRating?: number | null;
  sellerComment?: string;
  featuredUntil?: string | null;
  listingStatus?: "active" | "moderation" | "archived";
  ownerId?: string;
};

type PricePoint = {
  date: string;
  priceValue: number;
};

type ChatMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };
type ChatThread = { listingId: string; partnerId: string; lastMessage: ChatMessage };
type MessageReport = { id: string; reason: string; created_at: string; message?: { body?: string } | null };

type SavedSearch = {
  id: string;
  title: string;
  leftLetter: string;
  rightLetters: string;
  digits: string;
  region: string;
  regionCode: string;
  vehicle: Plate["vehicle"];
  priceLimit: number | null;
};

type SpecialFilter = "sameDigits" | "sameLetters" | "firstTen" | "roundHundred" | "mirror";
type PlatePicker = "left" | "digits" | "right" | "region" | null;

const specialFilterLabels: Record<SpecialFilter, string> = {
  sameDigits: "Одинаковые цифры",
  sameLetters: "Одинаковые буквы",
  firstTen: "Первая десятка",
  roundHundred: "Ровная сотня",
  mirror: "Зеркальный",
};
const allowedLetters = ["А", "В", "Е", "К", "М", "Н", "О", "Р", "С", "Т", "У", "Х"];
const allowedDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function formatListingDate(value?: string) {
  if (!value) return "Дата не указана";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
// Пользователь может печатать русской или английской раскладкой. Латинские
// аналоги приводим к буквам российского госномера, остальные символы отсекаем.
const latinPlateLetters: Record<string, string> = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };
function normalizePlateLetters(value: string, maxLength: number, allowWildcard = true) {
  return value
    .toUpperCase()
    .split("")
    .map((letter) => latinPlateLetters[letter] ?? letter)
    .filter((letter) => allowedLetters.includes(letter) || (allowWildcard && letter === "*"))
    .join("")
    .slice(0, maxLength);
}
function normalizePlateDigits(value: string, maxLength: number, allowWildcard = true) {
  return value.replace(allowWildcard ? /[^0-9*]/g : /\D/g, "").slice(0, maxLength);
}
// Дублирует серверную проверку из supabase/chat.sql, чтобы посетитель видел
// причину до отправки сообщения. Серверный фильтр остаётся главным.
const prohibitedChatPattern = /(?:хуй|хуе|ху[йїіе]|пизд|пізд|еба|їба|йоб|бля|бляд|сука|курва|мраз|гандон|идиот|fuck|f+u+c+k+|shit|bitch|asshole|bastard|cunt|dick|whore|slut|huy|hu[yi]|pizd|pizdets|ebat|yob|blya|suka|kurwa)/iu;

// Временные демонстрационные карточки. Реальные объявления добавляем только
// от владельцев или партнёров, которые дали на это разрешение.
const initialPlates: Plate[] = [
  { id: "runomer-71791", value: "Х 188 АМ", leftLetter: "Х", rightLetters: "АМ", digits: "188", region: "Москва · 777", price: "165 000 ₽", priceValue: 165000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Новое", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71791" },
  { id: "runomer-71792", value: "Х 666 КВ", leftLetter: "Х", rightLetters: "КВ", digits: "666", region: "Москва · 66", price: "900 000 ₽", priceValue: 900000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71792" },
  { id: "runomer-71793", value: "А 929 ВХ", leftLetter: "А", rightLetters: "ВХ", digits: "929", region: "Серпухов · 750", price: "30 000 ₽", priceValue: 30000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Зеркальный", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71793" },
  { id: "runomer-71795", value: "В 555 ХВ", leftLetter: "В", rightLetters: "ХВ", digits: "555", region: "Москва · 750", price: "400 000 ₽", priceValue: 400000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71795" },
  { id: "runomer-71796", value: "О 777 ТВ", leftLetter: "О", rightLetters: "ТВ", digits: "777", region: "Московская область · 190", price: "490 000 ₽", priceValue: 490000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Три семёрки", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71796" },
  { id: "runomer-71797", value: "М 222 УС", leftLetter: "М", rightLetters: "УС", digits: "222", region: "Московская область · 150", price: "390 000 ₽", priceValue: 390000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71797" },
  { id: "runomer-71798", value: "К 776 КТ", leftLetter: "К", rightLetters: "КТ", digits: "776", region: "Москва · 777", price: "250 000 ₽", priceValue: 250000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71798" },
  { id: "runomer-71801", value: "Р 900 ОН", leftLetter: "Р", rightLetters: "ОН", digits: "900", region: "Москва · 777", price: "239 000 ₽", priceValue: 239000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Ровный", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71801" },
  { id: "runomer-71804", value: "К 222 ЕА", leftLetter: "К", rightLetters: "ЕА", digits: "222", region: "Московская область · 150", price: "290 000 ₽", priceValue: 290000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71804" },
  { id: "runomer-71806", value: "Т 012 АС", leftLetter: "Т", rightLetters: "АС", digits: "012", region: "Коломна · 190", price: "50 000 ₽", priceValue: 50000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Новое", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71806" },
  { id: "runomer-71807-m001ao50", value: "М 001 АО", leftLetter: "М", rightLetters: "АО", digits: "001", region: "Подольск · 50", price: "900 000 ₽", priceValue: 900000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Нули · под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71807" },
  { id: "runomer-71807-a727aa150", value: "А 727 АА", leftLetter: "А", rightLetters: "АА", digits: "727", region: "Подольск · 150", price: "1 500 000 ₽", priceValue: 1500000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые буквы · под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71807" },
  { id: "runomer-71807-a797mo150", value: "А 797 МО", leftLetter: "А", rightLetters: "МО", digits: "797", region: "Подольск · 150", price: "1 000 000 ₽", priceValue: 1000000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71807" },
  { id: "runomer-71802", value: "С 999 ВО", leftLetter: "С", rightLetters: "ВО", digits: "999", region: "Регион не указан · 250", price: "350 000 ₽", priceValue: 350000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры · под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71802" },
  { id: "runomer-71803", value: "Н 020 АХ", leftLetter: "Н", rightLetters: "АХ", digits: "020", region: "Регион не указан · 50", price: "350 000 ₽", priceValue: 350000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Зеркальный · под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71803" },
  { id: "runomer-71805", value: "А 720 АА", leftLetter: "А", rightLetters: "АА", digits: "720", region: "Регион не указан · 190", price: "440 000 ₽", priceValue: 440000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые буквы · под ключ", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71805" },
  { id: "runomer-71808-e030et550", value: "Е 030 ЕТ", leftLetter: "Е", rightLetters: "ЕТ", digits: "030", region: "Московская область · 550", price: "55 000 ₽", priceValue: 55000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Зеркальный", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71808" },
  { id: "runomer-71808-k555oc790", value: "К 555 ОС", leftLetter: "К", rightLetters: "ОС", digits: "555", region: "Московская область · 790", price: "320 000 ₽", priceValue: 320000, vehicle: "car", seller: "Красивые номера на авто", createdAt: "2026-08-28", tag: "Одинаковые цифры", sourceName: "Открыть исходное объявление", sourceUrl: "https://t.me/runomer/71808" },
];

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [catalog, setCatalog] = useState<Plate[]>(initialPlates);
  const [archivedPartnerSources, setArchivedPartnerSources] = useState<string[]>([]);
  const [leftLetter, setLeftLetter] = useState("");
  const [rightLetters, setRightLetters] = useState("");
  const [digits, setDigits] = useState("");
  const [region, setRegion] = useState("Все");
  const [regionCode, setRegionCode] = useState("");
  const [vehicle, setVehicle] = useState<Plate["vehicle"]>("car");
  const [priceLimit, setPriceLimit] = useState<number | null>(null);
  const [specialFilters, setSpecialFilters] = useState<SpecialFilter[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogOnly, setCatalogOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"buy" | "sell" | "favorites" | "subscriptions">("buy");
  const [subscribedNumbers, setSubscribedNumbers] = useState<string[]>([]);
  const [similarToId, setSimilarToId] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [sort, setSort] = useState<"date" | "priceAsc" | "priceDesc">("date");
  const [platePicker, setPlatePicker] = useState<PlatePicker>(null);
  const [profileName, setProfileName] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [authMessage, setAuthMessage] = useState("");
  const [subscriptionToast, setSubscriptionToast] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [listingLeftLetter, setListingLeftLetter] = useState("");
  const [listingDigits, setListingDigits] = useState("");
  const [listingRightLetters, setListingRightLetters] = useState("");
  const [listingRegion, setListingRegion] = useState("Москва · 77");
  const [listingPrice, setListingPrice] = useState("");
  const [listingComment, setListingComment] = useState("");
  const [listingConfirmed, setListingConfirmed] = useState(false);
  const [listingMessage, setListingMessage] = useState("");
  const [selectedPlate, setSelectedPlate] = useState<Plate | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [listingPicker, setListingPicker] = useState<PlatePicker>(null);
  const [myListings, setMyListings] = useState<Plate[]>([]);
  const [moderationListings, setModerationListings] = useState<Plate[]>([]);
  const [moderationReports, setModerationReports] = useState<MessageReport[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatRecipientId, setChatRecipientId] = useState("");
  const [chatsOpen, setChatsOpen] = useState(false);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");

  useEffect(() => {
    if (!selectedPlate) {
      setPriceHistory([]);
      return;
    }

    const currentPrice = [{ date: selectedPlate.createdAt, priceValue: selectedPlate.priceValue }];
    setPriceHistory(currentPrice);
    if (!supabase) return;

    void supabase
      .from("listing_price_history")
      .select("price_rub, recorded_at")
      .eq("listing_id", selectedPlate.id)
      .order("recorded_at", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data?.length) return;
        const history = data
          .map((item) => ({
            date: item.recorded_at ? String(item.recorded_at).slice(0, 10) : selectedPlate.createdAt,
            priceValue: Number(item.price_rub),
          }))
          .filter((item) => Number.isFinite(item.priceValue));
        const last = history.at(-1);
        if (!last || last.priceValue !== selectedPlate.priceValue) history.push(currentPrice[0]);
        setPriceHistory(history);
      });
  }, [selectedPlate]);

  function mapManagedListing(item: any, ownerName: string): Plate {
    return {
      id: item.id,
      value: `${item.plate_left} ${item.plate_digits} ${item.plate_right}`,
      leftLetter: item.plate_left,
      rightLetters: item.plate_right,
      digits: item.plate_digits,
      region: item.region,
      price: `${Number(item.price_rub).toLocaleString("ru-RU")} ₽`,
      priceValue: Number(item.price_rub),
      vehicle: item.vehicle_type as Plate["vehicle"],
      seller: ownerName,
      createdAt: String(item.created_at).slice(0, 10),
      tag: item.status === "moderation" ? "На проверке" : item.status === "archived" ? "Снято с продажи" : "Активно",
      isSiteListing: true,
      listingStatus: item.status,
    };
  }

  async function loadManagement(userId?: string, ownerName = profileName) {
    if (!supabase || !userId) return;
    const client = supabase;
    const { data: own } = await client
      .from("auto_listings")
      .select("id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, status")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    setMyListings((own ?? []).map((item) => mapManagedListing(item, ownerName)));

    const { data: moderator } = await client.from("auto_moderators").select("user_id").eq("user_id", userId).maybeSingle();
    const canModerate = Boolean(moderator);
    setIsModerator(canModerate);
    if (!canModerate) return;
    const { data: pending } = await client
      .from("auto_listings")
      .select("id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, status")
      .eq("status", "moderation")
      .order("created_at", { ascending: true });
    setModerationListings((pending ?? []).map((item) => mapManagedListing(item, "Пользователь ЗаНомером")));
    const { data: reports } = await client
      .from("listing_message_reports")
      .select("id, reason, created_at, listing_messages(body)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setModerationReports((reports ?? []) as MessageReport[]);
  }

  async function archiveMyListing(listing: Plate) {
    if (!supabase) return;
    const { error } = await supabase.from("auto_listings").update({ status: "archived" }).eq("id", listing.id);
    if (error) return setAuthMessage("Не удалось снять объявление. Попробуй ещё раз.");
    const { data } = await supabase.auth.getUser();
    await loadManagement(data.user?.id, profileName);
  }

  async function reviewListing(listing: Plate, status: "active" | "archived") {
    if (!supabase) return;
    const note = status === "active" ? "Одобрено модератором" : "Не прошло проверку";
    const { error } = await supabase.rpc("review_auto_listing", { listing: listing.id, new_status: status, note });
    if (error) return setAuthMessage("Не удалось завершить модерацию. Проверь, что твой аккаунт добавлен в модераторы.");
    const { data } = await supabase.auth.getUser();
    await loadManagement(data.user?.id, profileName);
  }

  async function reviewMessageReport(report: MessageReport, status: "approved" | "rejected") {
    if (!supabase) return;
    const { error } = await supabase.rpc("review_listing_message_report", { report: report.id, new_status: status });
    if (error) return setAuthMessage("Не удалось обработать жалобу. Проверь права модератора.");
    const { data } = await supabase.auth.getUser();
    await loadManagement(data.user?.id, profileName);
  }

  async function openChat(listing: Plate) {
    if (!supabase) return;
    if (listing.ownerId && listing.ownerId === currentUserId) {
      setChatMessage("Нельзя написать самому себе по своему объявлению.");
      return;
    }

    let activeUserId = currentUserId;
    if (!isSignedIn || isAnonymous) {
      if (isAnonymous) await supabase.auth.signOut();
      setIsAnonymous(false);
      setIsSignedIn(false);
      setCurrentUserId("");
      setAuthMode("signup");
      setAuthStep(1);
      setAuthMessage("Чтобы написать продавцу, зарегистрируйся и подтверди почту.");
      setAuthOpen(true);
      return;
    }
    setChatMessage("");
    setChatDraft("");
    const { data, error } = await supabase
      .from("listing_messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: true });
    if (error) setChatMessage("Чат пока не подключён к базе. Выполни chat.sql в Supabase.");
    const messages = (data ?? []) as ChatMessage[];
    setChatMessages(messages);
    setChatRecipientId(listing.ownerId === activeUserId ? messages.filter((item) => item.sender_id !== activeUserId).at(-1)?.sender_id ?? "" : listing.ownerId ?? "");
    setChatOpen(true);
  }

  async function loadChatThreads() {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase
      .from("listing_messages")
      .select("id, listing_id, sender_id, recipient_id, body, created_at")
      .order("created_at", { ascending: false });
    if (error) return setChatMessage("Не удалось загрузить диалоги.");
    const threads = new Map<string, ChatThread>();
    ((data ?? []) as (ChatMessage & { listing_id: string })[]).forEach((item) => {
      const partnerId = item.sender_id === currentUserId ? item.recipient_id : item.sender_id;
      const key = `${item.listing_id}:${partnerId}`;
      if (!threads.has(key)) threads.set(key, { listingId: item.listing_id, partnerId, lastMessage: item });
    });
    setChatThreads([...threads.values()]);
  }

  async function openChats() {
    if (!currentUserId) {
      setChatMessage("Список диалогов появится после первого сообщения.");
      setChatsOpen(true);
      return;
    }
    await loadChatThreads();
    setChatsOpen(true);
  }

  async function sendReport() {
    if (!supabase || !reportingMessage || !reportReason.trim()) return setReportMessage("Кратко укажи причину жалобы.");
    const { error } = await supabase.from("listing_message_reports").insert({ message_id: reportingMessage.id, reason: reportReason.trim() });
    if (error) return setReportMessage("Не удалось отправить жалобу. Проверь, что в базе выполнен chat.sql.");
    setReportReason("");
    setReportMessage("Жалоба отправлена на проверку.");
  }

  async function rateSeller(score: number) {
    if (!supabase || !selectedPlate?.ownerId || !currentUserId) return setRatingMessage("Сначала зарегистрируйся и напиши продавцу.");
    if (selectedPlate.ownerId === currentUserId) return;
    const { error } = await supabase.from("seller_reviews").upsert({ listing_id: selectedPlate.id, seller_id: selectedPlate.ownerId, score }, { onConflict: "listing_id,reviewer_id" });
    setRatingMessage(error ? "Оценка пока не сохранена. Проверь обновление базы." : "Спасибо, оценка сохранена.");
  }

  async function sendChatMessage() {
    if (!supabase || !selectedPlate || !chatDraft.trim()) return;
    if (prohibitedChatPattern.test(chatDraft)) {
      setChatMessage("Сообщение содержит запрещённые слова на одном из языков. Измени текст.");
      return;
    }
    const recipientId = chatRecipientId || selectedPlate.ownerId;
    if (!recipientId) return setChatMessage("Не удалось определить получателя сообщения.");
    const { error } = await supabase.from("listing_messages").insert({ listing_id: selectedPlate.id, recipient_id: recipientId, body: chatDraft.trim() });
    if (error) {
      if (error.message.includes("запрещ")) return setChatMessage("Сообщение содержит запрещённые слова. Измени текст.");
      if (error.code === "42501") return setChatMessage("Чат не может отправить сообщение: в базе ещё не включены права для гостевого чата.");
      if (error.code === "23503") return setChatMessage("Это объявление уже удалено, поэтому написать по нему нельзя.");
      return setChatMessage(`Не удалось отправить: ${error.message}`);
    }
    setChatDraft("");
    await openChat(selectedPlate);
  }

  const priceChart = useMemo(() => {
    const points = priceHistory.slice(-6);
    const prices = points.map((item) => item.priceValue);
    const min = Math.min(...prices, 0);
    const max = Math.max(...prices, 1);
    return { max, min, points };
  }, [priceHistory]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function loadCatalog() {
      // Таблицы загружаются независимо: партнёрский каталог не должен исчезать,
      // если пользовательские объявления временно недоступны гостю по RLS.
      const [siteResult, partnerResult] = await Promise.all([
        client
          .from("auto_listings")
          .select("id, owner_id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, status, featured_until")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        client
          .from("partner_listings")
          .select("id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, tag, source_name, source_url, featured_until")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      const data = siteResult.data ?? [];
      const partnerData = partnerResult.data ?? [];
      if (siteResult.error && partnerResult.error) return;

      const ownerIds = data.map((item) => item.owner_id).filter(Boolean);
      const { data: profiles } = ownerIds.length
        ? await client.from("auto_profiles").select("id, username").in("id", ownerIds)
        : { data: [] as { id: string; username: string }[] };
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));
      const { data: reviewRows } = ownerIds.length
        ? await client.from("seller_reviews").select("seller_id, score").in("seller_id", ownerIds)
        : { data: [] as { seller_id: string; score: number }[] };
      const ratings = new Map<string, { total: number; count: number }>();
      (reviewRows ?? []).forEach((review) => {
        const current = ratings.get(review.seller_id) ?? { total: 0, count: 0 };
        ratings.set(review.seller_id, { total: current.total + Number(review.score), count: current.count + 1 });
      });

      const fromDatabase: Plate[] = data.map((item) => {
        const sellerReviews = ratings.get(item.owner_id);
        return {
        id: item.id,
        value: `${item.plate_left} ${item.plate_digits} ${item.plate_right}`,
        leftLetter: item.plate_left,
        rightLetters: item.plate_right,
        digits: item.plate_digits,
        region: item.region,
        price: `${Number(item.price_rub).toLocaleString("ru-RU")} ₽`,
        priceValue: Number(item.price_rub),
        vehicle: item.vehicle_type as Plate["vehicle"],
        seller: names.get(item.owner_id) ?? "Пользователь ЗаНомером",
        createdAt: item.created_at.slice(0, 10),
        publishedAt: item.created_at,
        tag: "Объявление",
        isSiteListing: true,
        ownerId: item.owner_id,
        sellerRating: sellerReviews ? sellerReviews.total / sellerReviews.count : null,
        featuredUntil: item.featured_until,
      };
      });
      const partners: Plate[] = partnerData.map((item) => ({
        id: item.id,
        value: `${item.plate_left} ${item.plate_digits} ${item.plate_right}`,
        leftLetter: item.plate_left,
        rightLetters: item.plate_right,
        digits: item.plate_digits,
        region: item.region,
        price: `${Number(item.price_rub).toLocaleString("ru-RU")} ₽`,
        priceValue: Number(item.price_rub),
        vehicle: item.vehicle_type as Plate["vehicle"],
        seller: item.source_name,
        createdAt: item.created_at.slice(0, 10),
        publishedAt: item.created_at,
        tag: item.tag ?? "Партнёрское объявление",
        sourceName: "Открыть исходное объявление",
        sourceUrl: item.source_url,
        featuredUntil: item.featured_until,
      }));

      const loaded = [...fromDatabase, ...partners];
      setCatalog([
        ...loaded,
        ...initialPlates.filter((plate) => !loaded.some((item) => item.id === plate.id)),
      ]);
    }

    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    async function loadPartnerListingStatuses() {
      const { data } = await supabase
        .from("partner_listing_statuses")
        .select("source_url")
        .eq("status", "archived");
      if (data) setArchivedPartnerSources(data.map((item) => item.source_url));
    }

    void loadPartnerListingStatuses();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    async function setProfile(user: { id?: string; email?: string | null; is_anonymous?: boolean; user_metadata?: Record<string, unknown> } | null) {
      const displayName = user?.user_metadata?.display_name;
      const guestName = user?.is_anonymous && user.id ? `Гость-${user.id.slice(0, 6)}` : "";
      const name = typeof displayName === "string" && displayName ? displayName : user?.email?.split("@")[0] ?? guestName;
      if (!user?.id || !name) {
        setProfileName(name);
        setIsSignedIn(false);
        setIsAnonymous(false);
        setCurrentUserId("");
        setMyListings([]); setModerationListings([]); setIsModerator(false);
        return;
      }
      setIsSignedIn(true);
      setIsAnonymous(Boolean(user.is_anonymous));
      setCurrentUserId(user.id);
      const { error } = await supabase.from("auto_profiles").upsert({ id: user.id, username: name }, { onConflict: "id" });
      if (error) {
        // Сессия уже подтверждена письмом. Не прячем профиль из-за того,
        // что похожее имя когда-то занял другой пользователь.
        setProfileName(name);
        setAuthMessage("Вход подтверждён. Имя для объявлений можно изменить позже.");
        void loadManagement(user.id, name);
        return;
      }
      setProfileName(name);
      void loadManagement(user.id, name);
      // На Android приложение один раз спросит разрешение, а затем сохранит
      // токен устройства для уведомлений о подходящих номерах.
      void registerForPushNotifications(user.id);
    }

    void supabase.auth.getUser().then(({ data }) => setProfile(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => setProfile(session?.user ?? null));
    return () => subscription.subscription.unsubscribe();
  }, []);

  const plates = useMemo(
    () => {
      const filtered = catalog.filter((plate) => {
        const isAvailable = !plate.sourceUrl || !archivedPartnerSources.includes(plate.sourceUrl);
        const matchesPattern = (value: string, pattern: string) => {
          const clean = pattern.trim().toUpperCase();
          if (!clean) return true;
          if (!clean.includes("*")) return value.includes(clean);
          const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".");
          return new RegExp(escaped).test(value);
        };
        const leftLetterMatch = matchesPattern(plate.leftLetter, leftLetter);
        const rightLettersMatch = matchesPattern(plate.rightLetters, rightLetters);
        const digitsMatch = matchesPattern(plate.digits, digits);
        const regionMatches = region === "Все" || plate.region.startsWith(region);
        const regionCodeMatches = !regionCode.trim() || plate.region.endsWith(regionCode.trim());
        const priceMatches = priceLimit === null || plate.priceValue <= priceLimit;
        const specialMatches = specialFilters.every((filter) => {
          if (filter === "sameDigits") return plate.digits[0] === plate.digits[1] && plate.digits[1] === plate.digits[2];
          if (filter === "sameLetters") return plate.leftLetter === plate.rightLetters[0] && plate.rightLetters[0] === plate.rightLetters[1];
          if (filter === "firstTen") return Number(plate.digits) >= 1 && Number(plate.digits) <= 10;
          if (filter === "roundHundred") return plate.digits.endsWith("00");
          return plate.digits === plate.digits.split("").reverse().join("");
        });
        return isAvailable && leftLetterMatch && rightLettersMatch && digitsMatch && regionMatches && regionCodeMatches && priceMatches && specialMatches && plate.vehicle === vehicle;
      });
      const source = catalog.find((plate) => plate.id === similarToId);
      const withSimilar = !source ? filtered : filtered.filter((plate) => plate.id !== source.id && (plate.digits === source.digits || plate.rightLetters === source.rightLetters));
      return [...withSimilar].sort((a, b) => sort === "priceAsc" ? a.priceValue - b.priceValue : sort === "priceDesc" ? b.priceValue - a.priceValue : b.createdAt.localeCompare(a.createdAt));
    },
    [catalog, archivedPartnerSources, leftLetter, rightLetters, digits, region, regionCode, priceLimit, specialFilters, vehicle, similarToId, sort],
  );

  const similarTo = catalog.find((plate) => plate.id === similarToId);
  const visiblePlates = activeTab === "favorites"
    ? catalog.filter((plate) => saved.includes(plate.id) && (!plate.sourceUrl || !archivedPartnerSources.includes(plate.sourceUrl)))
    : plates;
  const hotPlates = useMemo(() => {
    const now = new Date().toISOString();
    return plates.filter((plate) => !!plate.featuredUntil && plate.featuredUntil > now)
      .sort((a, b) => (b.featuredUntil ?? "").localeCompare(a.featuredUntil ?? ""));
  }, [plates]);
  const availableRegions = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>();
    catalog.forEach((plate) => {
      const title = plate.region.split(" · ")[0].trim();
      const code = plate.region.split(" · ")[1]?.trim();
      if (!code || title === "Регион не указан") return;
      const current = counts.get(code);
      counts.set(code, { title, count: (current?.count ?? 0) + 1 });
    });
    return [
      { value: "", title: "Все доступные регионы", count: catalog.length },
      ...Array.from(counts.entries()).sort(([codeA, a], [codeB, b]) => a.title.localeCompare(b.title, "ru") || Number(codeA) - Number(codeB)).map(([value, item]) => ({
        value,
        title: `${value} (${item.title})`,
        count: item.count,
      })),
    ];
  }, [catalog]);
  const selectedRegionOption = availableRegions.find((item) => item.value === regionCode);
  const selectedRegionLabel = regionCode || "77";
  const selectedRegionFilterLabel = selectedRegionOption?.title ?? "Все регионы";
  const hasSearchCriteria = Boolean(leftLetter || rightLetters || digits || regionCode || region !== "Все" || priceLimit !== null || specialFilters.length);

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      setSubscribedNumbers(next);
      const plate = catalog.find((item) => item.id === id);
      if (!current.includes(id) && plate) {
        const [regionTitle, savedRegionCode = ""] = plate.region.split(" · ");
        const alert: SavedSearch = {
          id: `favorite-${id}`,
          title: plate.value,
          leftLetter: plate.leftLetter,
          rightLetters: plate.rightLetters,
          digits: plate.digits,
          region: regionTitle || "Все",
          regionCode: savedRegionCode,
          vehicle: plate.vehicle,
          priceLimit: null,
        };
        setSavedSearches((searches) => [alert, ...searches.filter((item) => item.id !== alert.id)]);
        setSubscriptionToast(true);
      }
      if (current.includes(id)) setSavedSearches((searches) => searches.filter((item) => item.id !== `favorite-${id}`));
      return next;
    });
  }

  function makeSearchTitle() {
    const number = `${leftLetter || "А"} ${digits || "•••"} ${rightLetters || "АА"}`;
    const code = regionCode ? ` · ${regionCode}` : "";
    return `${number}${code}${region !== "Все" ? ` · ${region}` : ""}`;
  }

  function subscribeToCurrentSearch() {
    const current: SavedSearch = {
      id: `${Date.now()}`,
      title: makeSearchTitle(),
      leftLetter,
      rightLetters,
      digits,
      region,
      regionCode,
      vehicle,
      priceLimit,
    };
    setSavedSearches((searches) => [current, ...searches.filter((item) => item.title !== current.title)].slice(0, 8));
    setSubscriptionToast(true);
  }

  function applySavedSearch(search: SavedSearch) {
    setLeftLetter(search.leftLetter);
    setRightLetters(search.rightLetters);
    setDigits(search.digits);
    setRegion(search.region);
    setRegionCode(search.regionCode);
    setVehicle(search.vehicle);
    setPriceLimit(search.priceLimit);
    setActiveTab("favorites");
  }

  function choosePlatePart(value: string) {
    if (platePicker === "left") {
      setLeftLetter(value);
      setPlatePicker(null);
      return;
    }
    if (platePicker === "right") {
      setRightLetters((current) => current.length >= 2 ? value : `${current}${value}`);
      return;
    }
    if (platePicker === "digits") {
      setDigits((current) => current.length >= 3 ? value : `${current}${value}`);
    }
  }

  function erasePlatePart() {
    if (platePicker === "left") setLeftLetter("");
    if (platePicker === "right") setRightLetters((current) => current.slice(0, -1));
    if (platePicker === "digits") setDigits((current) => current.slice(0, -1));
  }

  function chooseListingPart(value: string) {
    if (listingPicker === "left") {
      setListingLeftLetter(value);
      setListingPicker(null);
      return;
    }
    if (listingPicker === "right") {
      setListingRightLetters((current) => current.length >= 2 ? value : `${current}${value}`);
      return;
    }
    if (listingPicker === "digits") {
      setListingDigits((current) => current.length >= 3 ? value : `${current}${value}`);
    }
  }

  function eraseListingPart() {
    if (listingPicker === "left") setListingLeftLetter("");
    if (listingPicker === "right") setListingRightLetters((current) => current.slice(0, -1));
    if (listingPicker === "digits") setListingDigits((current) => current.slice(0, -1));
  }

  async function addListing() {
    const priceValue = Number(listingPrice.replace(/\D/g, ""));
    if (!profileName || !listingLeftLetter || listingDigits.length !== 3 || listingRightLetters.length !== 2 || !priceValue || !listingConfirmed) {
      setListingMessage("Заполни номер и цену, а затем подтверди, что объявление размещает владелец.");
      return;
    }
    const normalizedRegion = listingRegion.trim();
    const normalizedPlate = `${listingLeftLetter.toUpperCase()} ${listingDigits} ${listingRightLetters.toUpperCase()}`;
    const hasForbiddenContact = /(https?:\/\/|www\.|t\.me\/|telegram|whatsapp|\+?\d[\d\s()\-]{8,}|[\w.+-]+@[\w-]+\.[\w.-]+)/i.test(listingComment);
    const duplicate = catalog.some((item) => item.isSiteListing && item.seller === profileName && item.value === normalizedPlate && item.region.toLowerCase() === normalizedRegion.toLowerCase());
    if (!allowedLetters.includes(listingLeftLetter.toUpperCase()) || !allowedLetters.includes(listingRightLetters[0]?.toUpperCase()) || !allowedLetters.includes(listingRightLetters[1]?.toUpperCase())) {
      setListingMessage("В номере можно использовать только разрешённые буквы российского госномера.");
      return;
    }
    if (!/^\d{1,3}$/.test(normalizedRegion.split("·").at(-1)?.trim() ?? "")) {
      setListingMessage("Укажи регион в формате «Москва · 77» или выбери его из списка.");
      return;
    }
    if (priceValue < 1000 || priceValue > 50_000_000) {
      setListingMessage("Проверь цену: для модерации можно указать сумму от 1 000 до 50 000 000 ₽.");
      return;
    }
    if (duplicate) {
      setListingMessage("Такой номер с этим регионом уже есть в каталоге. Если это твоё объявление, оно появится в разделе «Мои объявления» после запуска этого раздела.");
      return;
    }
    if (hasForbiddenContact) {
      setListingMessage("Не добавляй в комментарий ссылки, Telegram, почту или телефон. Для безопасности связь с покупателем будет через сайт.");
      return;
    }
    const entry: Plate = {
      id: `${Date.now()}`,
      value: normalizedPlate,
      leftLetter: listingLeftLetter.toUpperCase(),
      rightLetters: listingRightLetters.toUpperCase(),
      digits: listingDigits,
      region: normalizedRegion,
      price: `${priceValue.toLocaleString("ru-RU")} ₽`,
      priceValue,
      vehicle: "car",
      seller: profileName,
      createdAt: new Date().toISOString().slice(0, 10),
      tag: "На проверке",
      isSiteListing: true,
      sellerRating: null,
      sellerComment: listingComment.trim(),
    };
    if (supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthMessage("Войди или зарегистрируйся, чтобы опубликовать объявление.");
        setAuthOpen(true);
        return;
      }
      const { error } = await supabase.from("auto_listings").insert({
        owner_id: userData.user.id,
        plate_left: entry.leftLetter,
        plate_digits: entry.digits,
        plate_right: entry.rightLetters,
        region: entry.region,
        vehicle_type: entry.vehicle,
        price_rub: entry.priceValue,
        status: isModerator ? "active" : "moderation",
      });
      if (error) {
        setAuthMessage("Не удалось опубликовать. Проверь вход в аккаунт и попробуй ещё раз.");
        return;
      }
    }
    setAddOpen(false);
    setListingLeftLetter(""); setListingDigits(""); setListingRightLetters(""); setListingPrice("");
    setListingComment("");
    setListingConfirmed(false);
    setListingMessage(isModerator
      ? "✓ Объявление опубликовано: твой аккаунт подтверждён как модератор."
      : "✓ Объявление принято: проверим номер, регион, цену и повторные публикации. После одобрения оно появится в разделе «Купить».");
  }

  async function submitAuth() {
    if (!supabase) {
      if (profileDraft.trim()) { setProfileName(profileDraft.trim()); setAuthOpen(false); }
      return;
    }
    setAuthMessage("");
    if (authMode === "signup") {
      if (authStep === 1) {
        if (profileDraft.trim().length < 2) return setAuthMessage("Введи имя минимум из двух символов.");
        // Не ждём сетевой запрос на первом шаге: на телефоне он мог зависать,
        // из-за чего кнопка «Далее» выглядела нерабочей. Дубликаты всё равно
        // запрещены уникальным индексом auto_profiles после входа по email.
        setAuthStep(2);
        return;
      }
      if (authStep === 2) {
        if (!authEmail.trim()) return setAuthMessage("Введи email.");
        const { error } = await supabase.auth.signInWithOtp({
          email: authEmail.trim(),
          options: {
            shouldCreateUser: true,
            data: { display_name: profileDraft.trim() },
            // Пока тестируем приложение в домашней сети, всегда возвращаем
            // пользователя на адрес телефона, а не на localhost компьютера.
            emailRedirectTo: "http://192.168.0.109:8081",
          },
        });
        if (error) return setAuthMessage(error.message);
        setAuthMessage("Мы отправили письмо. Открой ссылку в нём и вернись в ЗаНомером.");
        return;
      }
      return;
    }
    if (!authEmail.trim() || !authPassword) return setAuthMessage("Введи email и пароль.");
    const result = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    if (result.error) {
      setAuthMessage(result.error.message);
      return;
    }
    setAuthOpen(false);
  }

  return (
    <SafeAreaView style={styles.page}>
      <View pointerEvents="none" style={styles.backgroundGlowTop} />
      <View pointerEvents="none" style={styles.backgroundGlowRight} />
      <View pointerEvents="none" style={styles.backgroundGlowBottom} />
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.brand}>ЗаНомером</Text>
          <Text style={styles.subtitle}>Красивые номера — без лишнего</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => { void openChats(); }} style={styles.chatsButton} accessibilityLabel="Диалоги">
            <Text style={styles.chatsButtonText}>💬</Text>
            {chatThreads.some((thread) => thread.lastMessage.sender_id !== currentUserId) && <View style={styles.chatBadge} />}
          </Pressable>
          <Pressable onPress={() => setAuthOpen((value) => !value)} style={styles.accountButton}>
            <Text style={styles.accountButtonText}>{isSignedIn ? `👤 ${profileName || "Профиль"}` : "Войти"}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {authOpen && (
        <Modal transparent animationType="slide" onRequestClose={() => setAuthOpen(false)}>
          <Pressable style={styles.authOverlay} onPress={() => { setAuthOpen(false); setAuthMessage(""); }}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.authPanel}>
          <View style={styles.authHeader}>
            <Text style={styles.authTitle}>{isSignedIn ? "Твой профиль" : authMode === "signup" ? "Регистрация в ЗаНомером" : "Вход в ЗаНомером"}</Text>
            <Pressable
              accessibilityLabel="Закрыть"
              onPress={() => { setAuthOpen(false); setAuthMessage(""); }}
              hitSlop={12}
              style={styles.authClose}
            >
              <Text style={styles.authCloseText}>×</Text>
            </Pressable>
          </View>
          {isSignedIn ? (
            <>
              <Text style={styles.authHint}>Регистрация подтверждена. Для будущих входов можешь задать пароль.</Text>
              <TextInput value={authPassword} onChangeText={setAuthPassword} placeholder="Придумай пароль (минимум 6 символов)" placeholderTextColor="#98A2B3" style={styles.authInput} secureTextEntry />
              <Pressable onPress={async () => {
                if (!supabase) return;
                if (authPassword.length < 6) return setAuthMessage("Пароль должен быть не короче 6 символов.");
                const { error } = await supabase.auth.updateUser({ password: authPassword });
                if (error) return setAuthMessage(error.message);
                setAuthPassword("");
                setAuthMessage("Пароль сохранён.");
              }} style={styles.authSubmit}><Text style={styles.authSubmitText}>Сохранить пароль</Text></Pressable>
              {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
              <Pressable onPress={async () => {
                if (!supabase) return;
                const { data } = await supabase.auth.getUser();
                await loadManagement(data.user?.id, profileName);
                setManagementOpen((value) => !value);
              }} style={styles.managementButton}>
                <Text style={styles.managementButtonText}>{managementOpen ? "Скрыть мои объявления" : "Мои объявления и модерация"}</Text>
              </Pressable>
              {managementOpen && <View style={styles.managementPanel}>
                <Text style={styles.managementTitle}>Мои объявления</Text>
                <View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statValue}>{myListings.filter((item) => item.listingStatus === "active").length}</Text><Text style={styles.statLabel}>активных</Text></View><View style={styles.statCard}><Text style={styles.statValue}>{myListings.filter((item) => item.listingStatus === "moderation").length}</Text><Text style={styles.statLabel}>на проверке</Text></View><View style={styles.statCard}><Text style={styles.statValue}>0</Text><Text style={styles.statLabel}>сообщений</Text></View></View>
                {myListings.length === 0 ? <Text style={styles.managementHint}>Ты пока не размещал объявлений.</Text> : myListings.map((listing) => <View key={listing.id} style={styles.managementCard}>
                  <View><Text style={styles.managementPlate}>{listing.value}</Text><Text style={styles.managementMeta}>{listing.region} · {listing.price}</Text><Text style={styles.managementStatus}>{listing.tag}</Text></View>
                  {listing.listingStatus !== "archived" && <Pressable onPress={() => archiveMyListing(listing)} style={styles.archiveButton}><Text style={styles.archiveButtonText}>Снять</Text></Pressable>}
                </View>)}
                {isModerator && <>
                  <Text style={styles.managementTitle}>Очередь на проверку</Text>
                  {moderationListings.length === 0 ? <Text style={styles.managementHint}>Сейчас нет объявлений на проверке.</Text> : moderationListings.map((listing) => <View key={listing.id} style={styles.managementCard}>
                    <View><Text style={styles.managementPlate}>{listing.value}</Text><Text style={styles.managementMeta}>{listing.region} · {listing.price}</Text></View>
                    <View style={styles.reviewActions}><Pressable onPress={() => reviewListing(listing, "active")} style={styles.approveButton}><Text style={styles.approveButtonText}>Одобрить</Text></Pressable><Pressable onPress={() => reviewListing(listing, "archived")} style={styles.rejectButton}><Text style={styles.rejectButtonText}>Отклонить</Text></Pressable></View>
                  </View>)}
                  <Text style={styles.managementTitle}>Жалобы на сообщения</Text>
                  {moderationReports.length === 0 ? <Text style={styles.managementHint}>Новых жалоб нет.</Text> : moderationReports.map((report) => <View key={report.id} style={styles.managementCard}>
                    <View style={styles.reportReviewText}><Text style={styles.managementMeta}>Сообщение: {report.message?.body ?? "удалено"}</Text><Text style={styles.managementStatus}>Причина: {report.reason}</Text></View>
                    <View style={styles.reviewActions}><Pressable onPress={() => reviewMessageReport(report, "approved")} style={styles.approveButton}><Text style={styles.approveButtonText}>Принять</Text></Pressable><Pressable onPress={() => reviewMessageReport(report, "rejected")} style={styles.rejectButton}><Text style={styles.rejectButtonText}>Отклонить</Text></Pressable></View>
                  </View>)}
                </>}
              </View>}
              <Pressable onPress={async () => { if (supabase) await supabase.auth.signOut(); setProfileName(""); setIsSignedIn(false); setIsAnonymous(false); setAuthOpen(false); }}><Text style={styles.logoutText}>Выйти из профиля</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.authHint}>{supabase ? authMode === "signup" ? `Шаг ${authStep} из 2` : "Введи данные своего аккаунта" : "Укажи имя — оно будет видно в твоих объявлениях."}</Text>
              {authMode === "signup" && authStep === 1 && <TextInput value={profileDraft} onChangeText={setProfileDraft} placeholder="Имя для объявлений" placeholderTextColor="#98A2B3" style={styles.authInput} />}
              {supabase && authMode === "signup" && authStep === 2 && <TextInput value={authEmail} onChangeText={setAuthEmail} placeholder="Email" placeholderTextColor="#98A2B3" style={styles.authInput} autoCapitalize="none" keyboardType="email-address" />}
              {supabase && authMode === "signin" && <><TextInput value={authEmail} onChangeText={setAuthEmail} placeholder="Email" placeholderTextColor="#98A2B3" style={styles.authInput} autoCapitalize="none" keyboardType="email-address" /><TextInput value={authPassword} onChangeText={setAuthPassword} placeholder="Пароль" placeholderTextColor="#98A2B3" style={styles.authInput} secureTextEntry /></>}
              {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
              <View style={styles.authRow}>
                {supabase && <Pressable onPress={() => { setAuthMode((value) => value === "signup" ? "signin" : "signup"); setAuthStep(1); setAuthMessage(""); }} style={styles.authSwitch}><Text style={styles.authSwitchText}>{authMode === "signup" ? "Уже есть аккаунт" : "Зарегистрироваться"}</Text></Pressable>}
                <Pressable onPress={submitAuth} style={styles.authSubmit}><Text style={styles.authSubmitText}>{supabase ? authMode === "signup" ? authStep === 2 ? "Отправить ссылку" : "Далее" : "Войти" : "Далее"}</Text></Pressable>
              </View>
            </>
          )}
          </Pressable>
          </ScrollView>
          </Pressable>
        </Modal>
      )}

      {activeTab === "buy" && <Pressable onPress={() => setCatalogOnly((value) => !value)} style={[styles.catalogHeroButton, catalogOnly && styles.catalogHeroButtonActive]}>
        <Text style={[styles.catalogHeroButtonText, catalogOnly && styles.catalogHeroButtonTextActive]}>{catalogOnly ? "← Вернуться к подбору номера" : "▦ Смотреть все объявления"}</Text>
        <Text style={[styles.catalogHeroButtonHint, catalogOnly && styles.catalogHeroButtonHintActive]}>{catalogOnly ? "Поиск по буквам, цифрам и региону" : `${catalog.length} номеров из проверенных источников`}</Text>
      </Pressable>}

      {activeTab === "buy" && !catalogOnly && <>
      <View style={styles.searchArea}>
      <View style={styles.searchHeading}>
        <View>
          <Text style={styles.searchLabel}>Найди свой номер</Text>
          <Text style={styles.searchHint}>Введи часть номера или выбери нужные параметры</Text>
        </View>
        <View style={styles.catalogCount}><Text style={styles.catalogCountText}>{visiblePlates.length}</Text><Text style={styles.catalogCountCaption}>найдено</Text></View>
      </View>
      <View style={styles.vehicleTabs}>
        {([
          ["car", "🚗", "Авто"],
          ["motorcycle", "🏍️", "Мото"],
          ["truck", "🚚", "Грузовые"],
        ] as const).map(([type, icon, label]) => (
          <Pressable key={type} onPress={() => setVehicle(type)} style={[styles.vehicleTab, vehicle === type && styles.vehicleTabActive]}>
            <Text style={styles.vehicleIcon}>{icon}</Text>
            <Text style={[styles.vehicleLabel, vehicle === type && styles.vehicleLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.plateSearch}>
        <TextInput value={leftLetter} onChangeText={(value) => setLeftLetter(normalizePlateLetters(value, 1))} onFocus={() => setPlatePicker("left")} placeholder="А" placeholderTextColor="#B8C0CC" style={styles.plateInput} autoCapitalize="characters" maxLength={1} />
        <View style={styles.plateDivider} />
        <TextInput value={digits} onChangeText={(value) => setDigits(normalizePlateDigits(value, 3))} onFocus={() => setPlatePicker("digits")} placeholder="111" placeholderTextColor="#B8C0CC" style={styles.plateInput} keyboardType="default" maxLength={3} />
        <View style={styles.plateDivider} />
        <TextInput value={rightLetters} onChangeText={(value) => setRightLetters(normalizePlateLetters(value, 2))} onFocus={() => setPlatePicker("right")} placeholder="АА" placeholderTextColor="#B8C0CC" style={styles.plateInput} autoCapitalize="characters" maxLength={2} />
        <View style={styles.plateDivider} />
        <Pressable onPress={() => setPlatePicker("region")} style={styles.regionCodeBox}>
          <Text numberOfLines={1} style={[styles.regionCodeInput, region === "Все" && styles.regionCodePlaceholder]}>{selectedRegionLabel}</Text>
          <Text style={styles.rusLabel}>RUS 🇷🇺</Text>
        </Pressable>
      </View>

      {platePicker && <View style={[styles.platePickerPanel, platePicker === "region" && styles.regionPickerPanel, platePicker === "region" && windowWidth >= 1600 && styles.regionPickerPanelDesktop]}>
        <View style={styles.platePickerTopRow}>
          <Text style={styles.platePickerTitle}>{platePicker === "region" ? "Выбери регион" : platePicker === "digits" ? "Выбери цифры" : "Выбери буквы"}</Text>
          <Pressable onPress={() => setPlatePicker(null)} hitSlop={8}><Text style={styles.platePickerClose}>Готово</Text></Pressable>
        </View>
        {platePicker === "region" ? <View style={styles.regionPickerContent}>
          <Text style={styles.regionPickerHint}>Код региона и название. В списке только регионы из текущих объявлений.</Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.regionPickerScroll} contentContainerStyle={styles.regionPickerList}>
          {availableRegions.map((item) => <Pressable key={item.value || "all"} onPress={() => { setRegion("Все"); setRegionCode(item.value); setPlatePicker(null); }} style={[styles.pickerOption, styles.regionPickerOption, regionCode === item.value && styles.pickerOptionActive]}><Text style={[styles.pickerOptionText, regionCode === item.value && styles.pickerOptionTextActive]}>{item.title}</Text><Text style={[styles.regionPickerCount, regionCode === item.value && styles.regionPickerCountActive]}>{item.count}</Text></Pressable>)}
          </ScrollView>
        </View> : <View style={styles.pickerGrid}>
          {(platePicker === "digits" ? allowedDigits : allowedLetters).map((item) => <Pressable key={item} onPress={() => choosePlatePart(item)} style={styles.pickerOption}><Text style={styles.pickerOptionText}>{item}</Text></Pressable>)}
          <Pressable onPress={() => choosePlatePart("*")} style={[styles.pickerOption, styles.pickerStar]}><Text style={styles.pickerOptionText}>*</Text></Pressable>
          <Pressable onPress={erasePlatePart} style={[styles.pickerOption, styles.pickerErase]}><Text style={styles.pickerOptionText}>⌫</Text></Pressable>
        </View>}
      </View>}

      <Text style={styles.quickFiltersTitle}>Особенности номера</Text>
      <View style={styles.quickFilters}>
        <Pressable onPress={() => setPlatePicker("region")} style={styles.quickSelect}>
          <Text style={styles.quickSelectText}>⌖ Регион: {selectedRegionFilterLabel}</Text>
          <Text style={styles.quickSelectChevron}>⌄</Text>
        </Pressable>
        {(Object.keys(specialFilterLabels) as SpecialFilter[]).map((filter) => {
          const active = specialFilters.includes(filter);
          return <Pressable key={filter} onPress={() => setSpecialFilters((current) => active ? current.filter((item) => item !== filter) : [...current, filter])} style={[styles.quickFilter, active && styles.quickFilterActive]}>
            <Text style={[styles.quickFilterText, active && styles.quickFilterTextActive]}>{active ? "✓ " : ""}{specialFilterLabels[filter]}</Text>
          </Pressable>;
        })}
      </View>

      {hasSearchCriteria && <View style={styles.searchActions}>
        <Pressable onPress={subscribeToCurrentSearch} style={styles.saveSearchButton}>
          <Text style={styles.saveSearchText}>🔔 Сообщить, когда номер появится</Text>
        </Pressable>
      </View>}

      {!leftLetter && !rightLetters && !digits && !regionCode && region === "Все" && priceLimit === null && specialFilters.length === 0 && !similarToId && (
        <View style={styles.featuredSection}>
          <View style={styles.featuredHeading}>
            <Text style={styles.featuredTitle}>🔥 Горячие предложения</Text>
            <Text style={styles.featuredHint}>Добавлены владельцами</Text>
          </View>
          {hotPlates.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredList}>
              {hotPlates.map((plate) => (
                <Pressable key={plate.id} onPress={() => setSelectedPlate(plate)} style={styles.featuredCard}>
                  <Text numberOfLines={1} style={styles.featuredPlate}>{plate.value}</Text>
                  <Text numberOfLines={1} style={styles.featuredPrice}>{plate.price}</Text>
                  <Text numberOfLines={1} style={styles.featuredMeta}>{plate.region}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : <Text style={styles.noHotOffers}>Пока нет выделенных номеров</Text>}
        </View>
      )}

      {filtersOpen && <>
        <View style={styles.filterPanelTitleRow}>
          <Text style={styles.sectionTitle}>Дополнительные параметры</Text>
          <Pressable onPress={() => setFiltersOpen(false)} hitSlop={8}><Text style={styles.closeFiltersText}>Скрыть ×</Text></Pressable>
        </View>
      </>}
      </View>
      </>}

      {activeTab === "sell" && <View style={styles.tabScroll}>
        <View style={styles.sellIntro}>
          <Text style={styles.sellTitle}>Продай красивый номер</Text>
          <Text style={styles.sellHint}>После входа добавь номер, регион и цену. Каждое новое объявление сначала проверяется вручную.</Text>
          <Pressable onPress={() => setAddOpen(true)} style={styles.sellButton}>
            <Text style={styles.sellButtonText}>＋ Выставить объявление</Text>
          </Pressable>
        </View>
        {addOpen && (
          <View style={styles.addPanel}>
            <Text style={styles.addPanelTitle}>Новое объявление</Text>
            {!profileName ? <Text style={styles.addPanelHint}>Сначала войди через кнопку «Войти» сверху.</Text> : <>
              <View style={styles.addPlateRow}>
                <TextInput value={listingLeftLetter} onFocus={() => setListingPicker("left")} onChangeText={(value) => setListingLeftLetter(normalizePlateLetters(value, 1, false))} placeholder="А" placeholderTextColor="#98A2B3" style={styles.addSmallInput} autoCapitalize="characters" maxLength={1} />
                <TextInput value={listingDigits} onFocus={() => setListingPicker("digits")} onChangeText={(value) => setListingDigits(normalizePlateDigits(value, 3, false))} placeholder="777" placeholderTextColor="#98A2B3" style={styles.addDigitsInput} keyboardType="number-pad" maxLength={3} />
                <TextInput value={listingRightLetters} onFocus={() => setListingPicker("right")} onChangeText={(value) => setListingRightLetters(normalizePlateLetters(value, 2, false))} placeholder="АА" placeholderTextColor="#98A2B3" style={styles.addLettersInput} autoCapitalize="characters" maxLength={2} />
              </View>
              {listingPicker && listingPicker !== "region" && <View style={styles.listingPickerPanel}>
                <View style={styles.listingPickerHeader}>
                  <Text style={styles.listingPickerTitle}>{listingPicker === "digits" ? "Выбери цифры" : "Выбери буквы"}</Text>
                  <Pressable onPress={() => setListingPicker(null)}><Text style={styles.listingPickerDone}>Готово</Text></Pressable>
                </View>
                <View style={styles.listingPickerOptions}>
                  {(listingPicker === "digits" ? allowedDigits : allowedLetters).map((value) => <Pressable key={value} onPress={() => chooseListingPart(value)} style={styles.listingPickerOption}><Text style={styles.listingPickerOptionText}>{value}</Text></Pressable>)}
                  <Pressable onPress={eraseListingPart} style={[styles.listingPickerOption, styles.listingPickerErase]}><Text style={styles.listingPickerOptionText}>⌫</Text></Pressable>
                </View>
              </View>}
              <View style={styles.listingRegionRow}>
                <TextInput value={listingRegion} onFocus={() => setListingPicker("region")} onChangeText={setListingRegion} placeholder="Регион, например Москва · 77" placeholderTextColor="#98A2B3" style={[styles.addInput, styles.listingRegionInput]} />
                <Pressable onPress={() => setListingPicker(listingPicker === "region" ? null : "region")} style={styles.listingRegionButton}><Text style={styles.listingRegionButtonText}>Выбрать</Text></Pressable>
              </View>
              {listingPicker === "region" && <View style={styles.listingRegionPicker}>
                <Text style={styles.listingPickerTitle}>Доступные регионы</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listingRegionOptions}>
                  {availableRegions.filter((item) => item.value).map((item) => <Pressable key={item.value} onPress={() => { setListingRegion(`${item.title.replace(/^\d+ \((.+)\)$/, "$1")} · ${item.value}`); setListingPicker(null); }} style={styles.listingRegionOption}><Text style={styles.listingRegionOptionText}>{item.title}</Text></Pressable>)}
                </ScrollView>
              </View>}
              <TextInput value={listingPrice} onChangeText={setListingPrice} placeholder="Цена в рублях" placeholderTextColor="#98A2B3" style={styles.addInput} keyboardType="number-pad" />
              <Text style={styles.contactHint}>Не публикуй документы, VIN, банковские данные или чужие номера телефонов. Связь с покупателем позже будет через внутренний чат.</Text>
              <TextInput value={listingComment} onChangeText={setListingComment} placeholder="Комментарий продавца (необязательно)" placeholderTextColor="#98A2B3" style={[styles.addInput, styles.commentInput]} multiline />
              <Pressable onPress={() => setListingConfirmed((current) => !current)} style={styles.confirmRow}>
                <View style={[styles.confirmBox, listingConfirmed && styles.confirmBoxActive]}>{listingConfirmed && <Text style={styles.confirmTick}>✓</Text>}</View>
                <Text style={styles.confirmText}>Подтверждаю, что размещаю объявление о своём предложении и указал верные данные.</Text>
              </Pressable>
              {!!listingMessage && <Text style={styles.listingMessage}>{listingMessage}</Text>}
              <View style={styles.addPanelActions}>
                <Pressable onPress={() => setAddOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Отмена</Text></Pressable>
                <Pressable onPress={addListing} style={styles.publishButton}><Text style={styles.publishText}>Опубликовать</Text></Pressable>
              </View>
            </>}
          </View>
        )}
        <View style={styles.boostCard}>
          <Text style={styles.boostTitle}>🔥 Переместить в горячие предложения</Text>
          <Text style={styles.boostText}>Подними объявление в блок «Горячие предложения» и выше в каталоге.</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceOption}>
              <Text style={styles.priceTitle}>1 выделение</Text>
              <Text style={styles.priceValue}>129 ₽</Text>
              <Text style={styles.priceTerm}>на 48 часов</Text>
            </View>
            <View style={styles.priceOption}>
              <Text style={styles.priceTitle}>5 выделений</Text>
              <Text style={styles.priceValue}>499 ₽</Text>
              <Text style={styles.priceTerm}>99,80 ₽ за одно · на 48 ч.</Text>
            </View>
          </View>
          <Text style={styles.priceDiscount}>В пакете экономия 146 ₽</Text>
          <Text style={styles.permanentLabel}>Закрепление вверху навсегда</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceOption}>
              <Text style={styles.priceTitle}>1 закрепление</Text>
              <Text style={styles.priceValue}>399 ₽</Text>
              <Text style={styles.priceTerm}>пока объявление активно</Text>
            </View>
            <View style={styles.priceOption}>
              <Text style={styles.priceTitle}>5 закреплений</Text>
              <Text style={styles.priceValue}>1 599 ₽</Text>
              <Text style={styles.priceTerm}>319,80 ₽ за одно</Text>
            </View>
          </View>
          <Text style={styles.priceDiscount}>В пакете экономия 396 ₽</Text>
        </View>
      </View>}

      {activeTab === "subscriptions" && <View style={styles.emptyTab}>
        <Text style={styles.emptyTabIcon}>✦</Text>
        <Text style={styles.emptyTabTitle}>ЗаНомером Плюс</Text>
        <View style={styles.premiumCard}>
          <Text style={styles.premiumTitle}>Подписка Плюс · 199 ₽ / месяц</Text>
          <Text style={styles.premiumItem}>◉ Ранний доступ к объявлениям — на 15 минут раньше</Text>
          <Text style={styles.premiumItem}>◉ История изменения цены номера</Text>
          <Text style={styles.premiumItem}>◉ До 30 сохранённых поисков и отслеживаний</Text>
          <Pressable style={styles.comingSoonButton}><Text style={styles.comingSoonButtonText}>Подписка появится позже</Text></Pressable>
        </View>
      </View>}

      {(activeTab === "buy" || activeTab === "favorites") && <>
      <View style={[styles.listHeader, activeTab === "favorites" && styles.favoritesHeader, activeTab === "buy" && !similarTo && styles.catalogHeaderWithoutTitle]}>
        {(activeTab === "favorites" || similarTo) && <Text numberOfLines={1} style={[styles.sectionTitle, styles.listTitle, activeTab === "favorites" && styles.favoritesTitle]}>{activeTab === "favorites" ? "Избранное и сохранённое" : `Похожие на ${similarTo.value}`}</Text>}
        {activeTab === "buy" && <View style={styles.resultCount}><Text style={styles.resultCountText}>Объявлений: {visiblePlates.length}</Text></View>}
      </View>
      {activeTab === "buy" && <View style={styles.listFilters}>
        {[[null, "Любая цена"], [100000, "до 100 тыс."], [300000, "до 300 тыс."], [1000000, "до 1 млн"]].map(([limit, label]) => <Pressable key={label} onPress={() => setPriceLimit(limit as number | null)} style={[styles.listFilterButton, priceLimit === limit && styles.listFilterButtonActive]}><Text style={[styles.listFilterButtonText, priceLimit === limit && styles.listFilterButtonTextActive]}>₽ {label}</Text></Pressable>)}
      </View>}
      {similarTo && (
        <Pressable onPress={() => setSimilarToId(null)} style={styles.clearSimilarButton}>
          <Text style={styles.clearSimilarText}>Показать все номера</Text>
        </Pressable>
      )}

      {activeTab === "favorites" && <View style={styles.savedSearchesPanel}>
        <Text style={styles.savedSearchesTitle}>Уведомления о поисках</Text>
        {savedSearches.length === 0 ? (
          <Text style={styles.savedSearchesEmpty}>Настрой номер в поиске и нажми «Сообщить, когда номер появится».</Text>
        ) : savedSearches.map((search) => (
          <View key={search.id} style={styles.savedSearchRow}>
            <Pressable onPress={() => applySavedSearch(search)} style={styles.savedSearchApply}>
              <Text numberOfLines={1} style={styles.savedSearchName}>🔔 {search.title}</Text>
              <Text style={styles.savedSearchHint}>Уведомления включены · нажми, чтобы применить поиск</Text>
            </Pressable>
            <Pressable onPress={() => setSavedSearches((items) => items.filter((item) => item.id !== search.id))} hitSlop={8}>
              <Text style={styles.savedSearchRemove}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>}

      <FlatList
        data={visiblePlates}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        scrollEnabled
        style={styles.listContainer}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSaved = saved.includes(item.id);
          return (
            <Pressable onPress={() => setSelectedPlate(item)} style={styles.card}>
              <View style={styles.plate}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.plateValue}>{item.value}</Text>
                <Text numberOfLines={1} style={styles.plateRegion}>{item.region.split(" · ")[1]}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTopRow}>
                  <Text numberOfLines={1} style={styles.tag}>{item.tag}</Text>
                  {!!item.sourceUrl && <View style={styles.availableBadge}><Text style={styles.availableBadgeText}>В наличии</Text></View>}
                </View>
                <Text numberOfLines={1} style={styles.region}>{item.region}</Text>
                <Text numberOfLines={1} style={styles.seller}>Продавец: {item.seller}</Text>
                <Text numberOfLines={1} style={styles.seller}>Опубликовано: {formatListingDate(item.publishedAt ?? item.createdAt)}</Text>
                {!!item.sellerRating && <View style={styles.catalogRating}><Text style={styles.catalogRatingText}>★ {item.sellerRating.toFixed(1)} · продавец оценён</Text></View>}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.price}>{item.price}</Text>
                  <View style={styles.catalogSourceBadge}><Text numberOfLines={1} style={styles.catalogSourceText}>{item.sourceUrl ? "Источник проверен" : "Объявление сайта"}</Text></View>
                </View>
                {!!item.sourceUrl && <Pressable onPress={() => Linking.openURL(item.sourceUrl!)} style={styles.sourceButton}>
                  <Text numberOfLines={1} style={styles.sourceButtonText}>Открыть объявление ↗</Text>
                </Pressable>}
                {activeTab === "buy" && <Pressable onPress={() => setSimilarToId(item.id)} style={styles.similarButton}>
                  <Text numberOfLines={1} style={styles.similarButtonText}>Похожие номера ›</Text>
                </Pressable>}
              </View>
              <Pressable onPress={() => toggleSaved(item.id)} hitSlop={10} style={styles.heart}>
                <Text style={isSaved ? styles.heartActive : styles.heartText}>{isSaved ? "♥" : "♡"}</Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{activeTab === "favorites" ? "В избранном пока нет номеров. Сохранённые поиски находятся выше." : "Номеров с такими параметрами пока нет. Попробуй изменить поиск."}</Text>}
      />
      </>}

      </ScrollView>

      <Modal visible={!!selectedPlate} transparent animationType="slide" onRequestClose={() => setSelectedPlate(null)}>
        <Pressable style={styles.detailsOverlay} onPress={() => setSelectedPlate(null)}>
          <ScrollView contentContainerStyle={styles.detailsScroll}>
            <Pressable onPress={(event) => event.stopPropagation()} style={styles.detailsPanel}>
              <View style={styles.detailsHeader}>
                <View>
                  <Text style={styles.detailsTitle}>{selectedPlate?.value}</Text>
                  <Text style={styles.detailsPrice}>{selectedPlate?.price}</Text>
                </View>
                <Pressable onPress={() => setSelectedPlate(null)} hitSlop={12} style={styles.detailsClose}><Text style={styles.detailsCloseText}>×</Text></Pressable>
              </View>
              <View style={styles.detailsPlatePreview}>
                <Text style={styles.detailsPlateValue}>{selectedPlate?.value}</Text>
                <Text style={styles.detailsPlateRegion}>{selectedPlate?.region}</Text>
              </View>
              <View style={styles.detailsBlock}>
                <Text style={styles.detailsLabel}>Регион</Text><Text style={styles.detailsValue}>{selectedPlate?.region}</Text>
                <Text style={styles.detailsLabel}>Дата и время публикации</Text><Text style={styles.detailsValue}>{formatListingDate(selectedPlate?.publishedAt ?? selectedPlate?.createdAt)}</Text>
                <Text style={styles.detailsLabel}>{selectedPlate?.isSiteListing ? "Ник продавца" : "Продавец"}</Text><Text style={styles.detailsValue}>{selectedPlate?.seller}</Text>
              </View>
              <View style={styles.priceHistoryBlock}>
                <View style={styles.priceHistoryHeader}>
                  <Text style={styles.priceHistoryTitle}>Изменение цены</Text>
                  <Text style={styles.priceHistoryCaption}>{priceChart.points.length > 1 ? `${priceChart.points.length} знач.` : "Без изменений"}</Text>
                </View>
                {priceChart.points.length > 1 ? <View style={styles.priceChart}>
                  {priceChart.points.map((point, index) => {
                    const height = priceChart.max === priceChart.min
                      ? 42
                      : 16 + ((point.priceValue - priceChart.min) / (priceChart.max - priceChart.min)) * 62;
                    return <View key={`${point.date}-${index}`} style={styles.priceChartColumn}>
                      <Text numberOfLines={1} style={styles.priceChartValue}>{point.priceValue.toLocaleString("ru-RU")} ₽</Text>
                      <View style={styles.priceChartTrack}>
                        <View style={[styles.priceChartBar, { height }]} />
                      </View>
                      <Text style={styles.priceChartDate}>{point.date.slice(5).split("-").reverse().join(".")}</Text>
                    </View>;
                  })}
                </View> : <View style={styles.priceHistoryEmpty}>
                  <Text style={styles.priceHistoryEmptyValue}>{selectedPlate?.price}</Text>
                  <Text style={styles.priceHistoryEmptyDate}>Цена на {priceChart.points[0]?.date.split("-").reverse().join(".")}</Text>
                </View>}
                {priceChart.points.length === 1 && <Text style={styles.priceHistoryHint}>Цена пока не менялась. График появится после первого подтверждённого изменения.</Text>}
              </View>
              {selectedPlate?.isSiteListing ? <View style={styles.detailsBlock}>
                <Text style={styles.detailsLabel}>Рейтинг продавца</Text>
                <Text style={styles.detailsValue}>{selectedPlate.sellerRating ? `★ ${selectedPlate.sellerRating.toFixed(1)} / 5` : "Пока нет отзывов"}</Text>
                {selectedPlate.sellerRating && selectedPlate.sellerRating >= 4.5 && <Text style={styles.verifiedSeller}>✓ Проверенный продавец</Text>}
                {selectedPlate.ownerId !== currentUserId && <View style={styles.ratingRow}><Text style={styles.ratingPrompt}>Оценить продавца:</Text>{[1,2,3,4,5].map((score) => <Pressable key={score} onPress={() => { void rateSeller(score); }}><Text style={styles.ratingStar}>★</Text></Pressable>)}</View>}
                {!!ratingMessage && <Text style={styles.detailsMuted}>{ratingMessage}</Text>}
                {!!selectedPlate.sellerComment && <><Text style={styles.detailsLabel}>Комментарий продавца</Text><Text style={styles.detailsComment}>{selectedPlate.sellerComment}</Text></>}
                <View style={styles.safeContactCard}>
                  <Text style={styles.safeContactTitle}>Безопасная связь</Text>
                  <Text style={styles.detailsMuted}>Контакты продавца не показываются всем посетителям. Для общения используй внутренний чат.</Text>
                </View>
                {selectedPlate.ownerId !== currentUserId && <Pressable onPress={() => openChat(selectedPlate)} style={styles.chatOpenButton}><Text style={styles.chatOpenButtonText}>Написать продавцу</Text></Pressable>}
                {!selectedPlate.sellerComment && <Text style={styles.detailsMuted}>Продавец пока не оставил комментарий.</Text>}
              </View> : <View style={styles.detailsBlock}>
                <Text style={styles.detailsMuted}>Это объявление партнёрского канала. Личные контакты и комментарий продавца в ЗаНомером не публикуются.</Text>
                {!!selectedPlate?.sourceUrl && <Pressable onPress={() => Linking.openURL(selectedPlate.sourceUrl!)} style={styles.detailsSource}><Text style={styles.detailsSourceText}>Открыть исходное объявление ↗</Text></Pressable>}
              </View>}
              <View style={styles.legalNotice}>
                <Text style={styles.legalNoticeTitle}>Важно</Text>
                <Text style={styles.legalNoticeText}>ЗаНомером — площадка объявлений, а не сторона сделки. Оформление автомобиля и регистрационные действия проходят по правилам ГИБДД.</Text>
              </View>
              <View style={styles.safeDealGuide}><Text style={styles.safeDealTitle}>Как оформить безопасно</Text><Text style={styles.safeDealText}>1. Проверь номер и документы владельца.  2. Не переводи деньги незнакомому человеку заранее.  3. Оформляй сделку и регистрационные действия по правилам ГИБДД.</Text></View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>

      <Modal visible={chatOpen} transparent animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <Pressable style={styles.detailsOverlay} onPress={() => setChatOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <View style={styles.chatSellerMark}><Text style={styles.chatSellerMarkText}>З</Text></View>
              <View style={styles.chatHeaderText}><Text style={styles.chatTitle}>Чат по объявлению</Text><Text style={styles.chatSubtitle}>{selectedPlate?.value} · {selectedPlate?.seller}</Text></View>
              <Pressable onPress={() => setChatOpen(false)} style={styles.chatClose}><Text style={styles.chatCloseText}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatMessages}>
              {chatMessages.length === 0 ? <View style={styles.chatEmpty}><Text style={styles.chatEmptyIcon}>✦</Text><Text style={styles.chatEmptyTitle}>Начните переписку</Text><Text style={styles.chatEmptyText}>Уточните цену, оформление или детали номера.</Text></View> : chatMessages.map((message) => <View key={message.id} style={[styles.chatBubbleRow, message.sender_id === currentUserId && styles.chatBubbleRowOwn]}><Pressable onPress={() => { if (selectedPlate?.ownerId === currentUserId && message.sender_id !== currentUserId) setChatRecipientId(message.sender_id); }} style={[styles.chatBubble, message.sender_id === currentUserId && styles.chatBubbleOwn]}><Text style={[styles.chatBubbleText, message.sender_id === currentUserId && styles.chatBubbleTextOwn]}>{message.body}</Text></Pressable>{message.sender_id !== currentUserId && <Pressable onPress={() => { setReportingMessage(message); setReportReason(""); setReportMessage(""); }} style={styles.reportButton}><Text style={styles.reportButtonText}>⚑</Text></Pressable>}</View>)}
            </ScrollView>
            <View style={styles.chatSafetyCard}><Text style={styles.chatSafetyIcon}>⌁</Text><Text style={styles.chatSafety}>{selectedPlate?.ownerId === currentUserId ? "Нажми на сообщение покупателя, чтобы выбрать его для ответа." : "Не отправляй документы, банковские данные или номера карт."}</Text></View>
            {!!chatMessage && <Text style={styles.authMessage}>{chatMessage}</Text>}
            <View style={styles.chatInputRow}><TextInput value={chatDraft} onChangeText={setChatDraft} placeholder="Напишите сообщение…" placeholderTextColor="#98A2B3" style={styles.chatInput} multiline /><Pressable onPress={sendChatMessage} style={styles.chatSend}><Text style={styles.chatSendText}>➤</Text></Pressable></View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={chatsOpen} transparent animationType="slide" onRequestClose={() => setChatsOpen(false)}>
        <Pressable style={styles.detailsOverlay} onPress={() => setChatsOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.dialogsPanel}>
            <View style={styles.dialogsHeader}><Text style={styles.dialogsTitle}>Диалоги</Text><Pressable onPress={() => setChatsOpen(false)} style={styles.chatClose}><Text style={styles.chatCloseText}>×</Text></Pressable></View>
            <Text style={styles.dialogsHint}>Все сообщения по объявлениям в одном месте.</Text>
            <ScrollView contentContainerStyle={styles.dialogsList}>
              {chatThreads.length === 0 ? <Text style={styles.dialogsEmpty}>Пока нет диалогов. Напиши продавцу из карточки объявления.</Text> : chatThreads.map((thread) => {
                const listing = catalog.find((item) => item.id === thread.listingId);
                return <Pressable key={`${thread.listingId}-${thread.partnerId}`} onPress={async () => { setChatsOpen(false); if (listing) await openChat(listing); }} style={styles.dialogCard}><View style={styles.dialogMark}><Text style={styles.dialogMarkText}>З</Text></View><View style={styles.dialogBody}><Text style={styles.dialogPlate}>{listing?.value ?? "Объявление"}</Text><Text numberOfLines={1} style={styles.dialogPreview}>{thread.lastMessage.sender_id === currentUserId ? "Вы: " : "Новое: "}{thread.lastMessage.body}</Text></View><Text style={styles.dialogTime}>{new Date(thread.lastMessage.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</Text></Pressable>;
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!reportingMessage} transparent animationType="fade" onRequestClose={() => setReportingMessage(null)}>
        <Pressable style={styles.detailsOverlay} onPress={() => setReportingMessage(null)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.reportPanel}>
            <View style={styles.dialogsHeader}><Text style={styles.dialogsTitle}>Пожаловаться</Text><Pressable onPress={() => setReportingMessage(null)} style={styles.chatClose}><Text style={styles.chatCloseText}>×</Text></Pressable></View>
            <Text style={styles.dialogsHint}>Жалоба попадёт модератору. Не указывай личные данные.</Text>
            <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Например: спам или оскорбление" placeholderTextColor="#98A2B3" style={styles.reportInput} multiline />
            {!!reportMessage && <Text style={styles.authMessage}>{reportMessage}</Text>}
            <Pressable onPress={() => { void sendReport(); }} style={styles.reportSubmit}><Text style={styles.reportSubmitText}>Отправить жалобу</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.bottomNav}>
        {([
          ["buy", "⌕", "Купить", "#155EEF"],
          ["sell", "＋", "Продать", "#F04438"],
          ["favorites", "♡", "Избранное и сохранённое", "#D92D20"],
          ["subscriptions", "🔔", "Подписка", "#D97706"],
        ] as const).map(([tab, icon, label, color], index) => <View key={tab} style={styles.navSlot}>
          <Pressable onPress={() => setActiveTab(tab)} style={[styles.navItem, activeTab === tab && styles.navItemActive]}>
            <Text style={[styles.navIcon, { color }]}>{icon}</Text>
            <Text style={[styles.navText, { color: activeTab === tab ? color : "#667085" }]}>{label}</Text>
          </Pressable>
          {index < 3 && <View style={styles.navDivider} />}
        </View>)}
      </View>
      {subscriptionToast && <Pressable onPress={() => setSubscriptionToast(false)} style={styles.toast}>
        <Text style={styles.toastText}>✓ Уведомления включены</Text>
      </Pressable>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#F8F7FC", flex: 1, overflow: "hidden", paddingLeft: 24, paddingRight: 24, width: "100%" },
  mainScroll: { flex: 1, marginHorizontal: -24 },
  mainScrollContent: { paddingBottom: 112, paddingHorizontal: 24 },
  backgroundGlowTop: { backgroundColor: "#DDE7FF", borderRadius: 999, height: 250, left: -50, opacity: 0.56, position: "absolute", top: 170, transform: [{ rotate: "-18deg" }], width: 250 },
  backgroundGlowRight: { backgroundColor: "#EADFFF", borderRadius: 999, height: 390, opacity: 0.72, position: "absolute", right: -190, top: 235, width: 440 },
  backgroundGlowBottom: { backgroundColor: "#D9F4E9", borderRadius: 999, bottom: -270, height: 470, left: "18%", opacity: 0.58, position: "absolute", width: 550 },
  header: { backgroundColor: "#FFFEFF", borderBottomColor: "#E9E6F4", borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -24, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18, shadowColor: "#342E62", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  headerBrand: { flex: 1, minWidth: 0, paddingRight: 8 },
  brand: { color: "#352F67", fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "#716A88", fontSize: 14, marginTop: 3 },
  headerActions: { alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 8 },
  chatsButton: { alignItems: "center", backgroundColor: "#F4F3FA", borderRadius: 14, height: 42, justifyContent: "center", position: "relative", width: 42 },
  chatsButtonText: { fontSize: 18 },
  chatBadge: { backgroundColor: "#F04438", borderColor: "#FFFFFF", borderRadius: 6, borderWidth: 2, height: 12, position: "absolute", right: 4, top: 4, width: 12 },
  catalogHeroButton: { alignSelf: "center", backgroundColor: "#5143C2", borderRadius: 18, marginTop: 16, maxWidth: 760, paddingHorizontal: 18, paddingVertical: 15, shadowColor: "#5143C2", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.25, shadowRadius: 14, width: "100%" },
  catalogHeroButtonActive: { backgroundColor: "#E8F8F0", borderColor: "#B7E6CD", borderWidth: 1, shadowOpacity: 0 },
  catalogHeroButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "center" },
  catalogHeroButtonTextActive: { color: "#18794E" },
  catalogHeroButtonHint: { color: "#DCD8FF", fontSize: 11, fontWeight: "700", marginTop: 3, textAlign: "center" },
  catalogHeroButtonHintActive: { color: "#4B8A69" },
  accountButton: { backgroundColor: "#F0EEFF", borderColor: "#E2DFFF", borderRadius: 14, borderWidth: 1, maxWidth: 150, paddingHorizontal: 12, paddingVertical: 9 },
  accountButtonText: { color: "#5143C2", fontSize: 13, fontWeight: "800" },
  savedButton: { backgroundColor: "#F2F4F7", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  savedButtonText: { color: "#344054", fontSize: 16, fontWeight: "700" },
  authOverlay: { backgroundColor: "rgba(16,24,40,0.48)", flex: 1 },
  authScroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  authPanel: { alignSelf: "center", backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: 18, borderWidth: 1, maxWidth: 440, padding: 16, width: "100%" },
  authHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  authTitle: { color: "#101828", fontSize: 16, fontWeight: "800" },
  authClose: { alignItems: "center", height: 30, justifyContent: "center", marginLeft: 12, width: 30 },
  authCloseText: { color: "#475467", fontSize: 28, fontWeight: "400", lineHeight: 30 },
  authHint: { color: "#667085", fontSize: 13, lineHeight: 18, marginTop: 5 },
  authRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 10 },
  authInput: { backgroundColor: "#FFFFFF", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, color: "#101828", fontSize: 14, marginTop: 8, paddingHorizontal: 11, paddingVertical: 9 },
  authSubmit: { alignItems: "center", backgroundColor: "#155EEF", borderRadius: 10, flexGrow: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 12 },
  authSubmitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  authSwitch: { alignItems: "center", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, flexGrow: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 10, paddingVertical: 10 },
  authSwitchText: { color: "#475467", fontSize: 12, fontWeight: "750" },
  authMessage: { color: "#B42318", fontSize: 12, lineHeight: 17, marginTop: 8 },
  managementButton: { alignItems: "center", backgroundColor: "#F0EEFF", borderColor: "#D8D1FF", borderRadius: 10, borderWidth: 1, marginTop: 10, paddingVertical: 10 },
  managementButtonText: { color: "#5143C2", fontSize: 13, fontWeight: "900" },
  managementPanel: { borderTopColor: "#E4E0F3", borderTopWidth: 1, marginTop: 12, paddingTop: 11 },
  managementTitle: { color: "#352F67", fontSize: 14, fontWeight: "900", marginTop: 6 },
  reportReviewText: { flex: 1, paddingRight: 8 },
  managementHint: { color: "#716A88", fontSize: 12, lineHeight: 17, marginTop: 6 },
  managementCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E0F3", borderRadius: 11, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 8, padding: 10 },
  managementPlate: { color: "#24213E", fontSize: 14, fontWeight: "900" },
  managementMeta: { color: "#716A88", fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 7, marginVertical: 10 },
  statCard: { alignItems: "center", backgroundColor: "#F4F3FA", borderRadius: 10, flex: 1, paddingVertical: 8 },
  statValue: { color: "#5143C2", fontSize: 17, fontWeight: "900" },
  statLabel: { color: "#667085", fontSize: 10, marginTop: 2 },
  managementStatus: { color: "#5143C2", fontSize: 11, fontWeight: "800", marginTop: 4 },
  archiveButton: { backgroundColor: "#FFF1F3", borderColor: "#FECDD6", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  archiveButtonText: { color: "#C01048", fontSize: 11, fontWeight: "900" },
  reviewActions: { flexDirection: "row", gap: 5 },
  approveButton: { backgroundColor: "#E8F8F0", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  approveButtonText: { color: "#18794E", fontSize: 11, fontWeight: "900" },
  rejectButton: { backgroundColor: "#FFF1F3", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  rejectButtonText: { color: "#C01048", fontSize: 11, fontWeight: "900" },
  logoutText: { color: "#D92D20", fontSize: 13, fontWeight: "750", marginTop: 9 },
  searchArea: { alignSelf: "center", backgroundColor: "#FFFEFF", borderColor: "#E2DEF7", borderRadius: 28, borderWidth: 1, maxWidth: 760, marginTop: 20, padding: 19, position: "relative", shadowColor: "#5A4FB2", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, width: "100%" },
  searchHeading: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  searchLabel: { color: "#24213E", fontSize: 21, fontWeight: "900" },
  searchHint: { color: "#716A88", fontSize: 12, lineHeight: 17, marginTop: 3 },
  catalogCount: { alignItems: "center", backgroundColor: "#EEEBFF", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6 },
  catalogCountText: { color: "#5143C2", fontSize: 15, fontWeight: "900" },
  catalogCountCaption: { color: "#655F7A", fontSize: 10, fontWeight: "700" },
  vehicleTabs: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 15 },
  vehicleTab: { alignItems: "center", backgroundColor: "#F2F4F7", borderColor: "#E2E8F0", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minWidth: 96, paddingHorizontal: 14, paddingVertical: 11 },
  vehicleTabActive: { backgroundColor: "#5143C2", borderColor: "#5143C2" },
  vehicleIcon: { fontSize: 18 },
  vehicleLabel: { color: "#475467", fontSize: 13, fontWeight: "800" },
  vehicleLabelActive: { color: "#FFFFFF" },
  plateSearch: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#202939", borderRadius: 14, borderWidth: 3, flexDirection: "row", height: 84, overflow: "hidden", shadowColor: "#101828", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 5, width: "100%" },
  plateInput: { color: "#111827", flex: 1, fontSize: 34, fontWeight: "900", height: "100%", letterSpacing: 1, minWidth: 0, textAlign: "center" },
  plateDivider: { backgroundColor: "#252525", height: "100%", width: 2 },
  quickFiltersTitle: { color: "#344054", fontSize: 14, fontWeight: "900", marginTop: 16 },
  quickFilters: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingBottom: 3, paddingTop: 9, width: "100%" },
  quickSelect: { alignItems: "center", backgroundColor: "#F4F2FF", borderColor: "#D8D1FF", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 15, paddingVertical: 11 },
  quickSelectText: { color: "#5143C2", fontSize: 13, fontWeight: "900" },
  quickSelectChevron: { color: "#5143C2", fontSize: 14, fontWeight: "900" },
  quickFilter: { backgroundColor: "#F3F8FF", borderColor: "#D8E5FF", borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  quickFilterActive: { backgroundColor: "#5143C2", borderColor: "#5143C2" },
  quickFilterText: { color: "#5143C2", fontSize: 13, fontWeight: "800" },
  quickFilterTextActive: { color: "#FFFFFF" },
  regionCodeBox: { alignItems: "center", flex: 1, height: "100%", justifyContent: "center", minWidth: 0 },
  regionCodeInput: { color: "#111827", fontSize: 18, fontWeight: "900", maxWidth: "100%", textAlign: "center" },
  regionCodePlaceholder: { color: "#667085" },
  rusLabel: { color: "#344054", fontSize: 10, fontWeight: "800", marginTop: -5 },
  advancedButton: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 13, paddingVertical: 5 },
  advancedButtonText: { color: "#155EEF", fontSize: 14, fontWeight: "700" },
  advancedChevron: { color: "#155EEF", fontSize: 22, fontWeight: "600" },
  searchActions: { flexDirection: "row", gap: 9, marginTop: 12 },
  saveSearchButton: { alignItems: "center", backgroundColor: "#5143C2", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12, shadowColor: "#5143C2", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.26, shadowRadius: 9 },
  saveSearchText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  savedSearchesButton: { alignItems: "center", backgroundColor: "#F2F4F7", borderRadius: 11, justifyContent: "center", minHeight: 42, paddingHorizontal: 11 },
  savedSearchesText: { color: "#344054", fontSize: 12, fontWeight: "750" },
  featuredSection: { marginTop: 18 },
  featuredHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  featuredTitle: { color: "#101828", fontSize: 15, fontWeight: "800" },
  featuredHint: { color: "#98A2B3", fontSize: 11, fontWeight: "650" },
  featuredList: { gap: 10, paddingRight: 4 },
  featuredCard: { backgroundColor: "#101828", borderRadius: 15, minWidth: 146, padding: 13 },
  featuredPlate: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  featuredPrice: { color: "#FCD34D", fontSize: 14, fontWeight: "800", marginTop: 7 },
  featuredMeta: { color: "#D0D5DD", fontSize: 11, marginTop: 4 },
  noHotOffers: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 13, borderWidth: 1, color: "#9A3412", fontSize: 12, fontWeight: "700", paddingHorizontal: 13, paddingVertical: 11 },
  savedSearchesPanel: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: 14, borderWidth: 1, marginTop: 9, padding: 12 },
  savedSearchesTitle: { color: "#101828", fontSize: 14, fontWeight: "800" },
  savedSearchesEmpty: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 6 },
  savedSearchRow: { alignItems: "center", borderTopColor: "#E2E8F0", borderTopWidth: 1, flexDirection: "row", gap: 8, marginTop: 9, paddingTop: 9 },
  savedSearchApply: { flex: 1 },
  savedSearchName: { color: "#155EEF", fontSize: 14, fontWeight: "750" },
  savedSearchHint: { color: "#667085", fontSize: 11, marginTop: 2 },
  savedSearchRemove: { color: "#98A2B3", fontSize: 27, lineHeight: 27 },
  addPanel: { backgroundColor: "#F8FAFC", borderColor: "#B2CCFF", borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  addPanelTitle: { color: "#101828", fontSize: 17, fontWeight: "800" },
  addPanelHint: { color: "#667085", fontSize: 13, lineHeight: 18, marginTop: 7 },
  addPlateRow: { flexDirection: "row", gap: 7, marginTop: 11 },
  addSmallInput: { backgroundColor: "#FFFFFF", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, color: "#101828", fontSize: 18, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 10, textAlign: "center", width: 55 },
  addDigitsInput: { backgroundColor: "#FFFFFF", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, color: "#101828", flex: 1, fontSize: 18, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 10, textAlign: "center" },
  addLettersInput: { backgroundColor: "#FFFFFF", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, color: "#101828", fontSize: 18, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 10, textAlign: "center", width: 76 },
  addInput: { backgroundColor: "#FFFFFF", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, color: "#101828", fontSize: 14, marginTop: 9, paddingHorizontal: 11, paddingVertical: 10 },
  listingPickerPanel: { backgroundColor: "#F7F6FF", borderColor: "#D8D1FF", borderRadius: 13, borderWidth: 1, marginTop: 9, padding: 11 },
  listingPickerHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  listingPickerTitle: { color: "#352F67", fontSize: 13, fontWeight: "900" },
  listingPickerDone: { color: "#5143C2", fontSize: 13, fontWeight: "900" },
  listingPickerOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  listingPickerOption: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D8D1FF", borderRadius: 9, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  listingPickerErase: { backgroundColor: "#FFF1F3", borderColor: "#FECDD6" },
  listingPickerOptionText: { color: "#5143C2", fontSize: 14, fontWeight: "900" },
  listingRegionRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  listingRegionInput: { flex: 1 },
  listingRegionButton: { backgroundColor: "#F0EEFF", borderColor: "#D8D1FF", borderRadius: 10, borderWidth: 1, marginTop: 9, paddingHorizontal: 11, paddingVertical: 11 },
  listingRegionButtonText: { color: "#5143C2", fontSize: 12, fontWeight: "900" },
  listingRegionPicker: { backgroundColor: "#F7F6FF", borderColor: "#D8D1FF", borderRadius: 13, borderWidth: 1, marginTop: 8, padding: 11 },
  listingRegionOptions: { gap: 7, paddingTop: 9 },
  listingRegionOption: { backgroundColor: "#FFFFFF", borderColor: "#D8D1FF", borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  listingRegionOptionText: { color: "#5143C2", fontSize: 12, fontWeight: "800" },
  contactHint: { color: "#667085", fontSize: 12, lineHeight: 17, marginTop: 13 },
  confirmRow: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 13 },
  confirmBox: { alignItems: "center", borderColor: "#98A2B3", borderRadius: 5, borderWidth: 1.5, height: 20, justifyContent: "center", marginTop: 1, width: 20 },
  confirmBoxActive: { backgroundColor: "#155EEF", borderColor: "#155EEF" },
  confirmTick: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  confirmText: { color: "#344054", flex: 1, fontSize: 12, lineHeight: 17 },
  listingMessage: { color: "#B54708", fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 10 },
  moderationNotice: { backgroundColor: "#FFFAEB", borderColor: "#FEDF89", borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 12 },
  moderationNoticeText: { color: "#B54708", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  commentInput: { minHeight: 82, textAlignVertical: "top" },
  addPanelActions: { flexDirection: "row", gap: 9, justifyContent: "flex-end", marginTop: 12 },
  cancelButton: { alignItems: "center", borderColor: "#D0D5DD", borderRadius: 10, borderWidth: 1, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 10 },
  cancelText: { color: "#475467", fontSize: 13, fontWeight: "750" },
  publishButton: { alignItems: "center", backgroundColor: "#155EEF", borderRadius: 10, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  publishText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  sectionTitle: { color: "#101828", fontSize: 16, fontWeight: "750", marginTop: 22 },
  filterPanelTitleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  closeFiltersText: { color: "#667085", fontSize: 12, fontWeight: "750", marginTop: 22 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  filter: { backgroundColor: "#F2F4F7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  filterActive: { backgroundColor: "#155EEF" },
  filterText: { color: "#475467", fontSize: 13, fontWeight: "650" },
  filterTextActive: { color: "#FFFFFF" },
  platePickerPanel: { backgroundColor: "#FFFFFF", borderColor: "#B2CCFF", borderRadius: 16, borderWidth: 1, marginTop: 10, padding: 12, shadowColor: "#155EEF", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12 },
  regionPickerPanel: { alignSelf: "flex-end", borderColor: "#D8D1FF", maxWidth: "100%", shadowColor: "#5143C2", width: 320, zIndex: 20 },
  regionPickerPanelDesktop: { left: "100%", marginLeft: 185, marginTop: 0, position: "absolute", top: 122, zIndex: 50 },
  platePickerTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  platePickerTitle: { color: "#101828", fontSize: 14, fontWeight: "900" },
  platePickerClose: { color: "#155EEF", fontSize: 13, fontWeight: "800" },
  regionPickerContent: { gap: 9 },
  regionPickerHint: { color: "#667085", fontSize: 12, lineHeight: 17 },
  regionPickerScroll: { maxHeight: 470 },
  regionPickerList: { gap: 7, paddingRight: 3 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerOption: { alignItems: "center", backgroundColor: "#F2F6FF", borderColor: "#D5E2FF", borderRadius: 10, borderWidth: 1, justifyContent: "center", minWidth: 42, paddingHorizontal: 11, paddingVertical: 9 },
  regionPickerOption: { alignSelf: "stretch", flexDirection: "row", gap: 7, justifyContent: "space-between", paddingHorizontal: 13 },
  pickerOptionActive: { backgroundColor: "#155EEF", borderColor: "#155EEF" },
  pickerOptionText: { color: "#175CD3", fontSize: 14, fontWeight: "900" },
  pickerOptionTextActive: { color: "#FFFFFF" },
  regionPickerCount: { color: "#667085", fontSize: 12, fontWeight: "900" },
  regionPickerCountActive: { color: "#DCEBFF" },
  pickerStar: { backgroundColor: "#FFF7E8", borderColor: "#FEDF89" },
  pickerErase: { backgroundColor: "#FEF3F2", borderColor: "#FECDCA" },
  listHeader: { alignItems: "center", alignSelf: "center", flexDirection: "row", justifyContent: "space-between", maxWidth: 1100, minWidth: 0, width: "100%" },
  listFilters: { alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, maxWidth: 1100, paddingBottom: 3, paddingTop: 10, width: "100%" },
  listFilterButton: { backgroundColor: "#FFFEFF", borderColor: "#E0DCF1", borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  listFilterButtonActive: { backgroundColor: "#5143C2", borderColor: "#5143C2" },
  listFilterButtonText: { color: "#4B4662", fontSize: 12, fontWeight: "800" },
  listFilterButtonTextActive: { color: "#FFFFFF" },
  catalogHeaderWithoutTitle: { justifyContent: "flex-end", marginTop: 10 },
  listTitle: { flex: 1, marginRight: 10, minWidth: 0 },
  resultCount: { backgroundColor: "#EEEBFF", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  resultCountText: { color: "#5143C2", fontSize: 12, fontWeight: "900" },
  favoritesHeader: { justifyContent: "center" },
  favoritesTitle: { flex: 0, marginRight: 0, textAlign: "center" },
  sortButton: { flexShrink: 1, maxWidth: "38%" },
  counter: { color: "#667085", fontSize: 13, marginTop: 22, textAlign: "right" },
  clearSimilarButton: { alignSelf: "flex-start", marginTop: 8 },
  clearSimilarText: { color: "#155EEF", fontSize: 13, fontWeight: "700" },
  listContainer: { alignSelf: "center", height: 540, maxWidth: 1100, width: "100%" },
  list: { gap: 12, paddingBottom: 96, paddingTop: 12 },
  card: { alignItems: "center", backgroundColor: "#FFFEFF", borderColor: "#E1DCF5", borderRadius: 22, borderWidth: 1, flexDirection: "row", minHeight: 146, overflow: "hidden", paddingBottom: 16, paddingLeft: 14, paddingRight: 48, paddingTop: 16, shadowColor: "#5143C2", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 15 },
  plate: { alignItems: "center", backgroundColor: "#F7F5FF", borderColor: "#3E395D", borderRadius: 14, borderWidth: 2, flexShrink: 0, justifyContent: "center", minHeight: 76, paddingHorizontal: 7, width: 112 },
  plateValue: { color: "#24213E", fontSize: 19, fontWeight: "900", maxWidth: "100%" },
  plateRegion: { color: "#605A78", fontSize: 11, fontWeight: "900", marginTop: 3, maxWidth: "100%" },
  cardInfo: { flex: 1, marginLeft: 12, minWidth: 0, overflow: "hidden" },
  cardTopRow: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between", minWidth: 0 },
  tag: { color: "#5143C2", flex: 1, flexShrink: 1, fontSize: 15, fontWeight: "850", minWidth: 0 },
  availableBadge: { backgroundColor: "#E8F8F0", borderColor: "#BAE9D1", borderRadius: 10, borderWidth: 1, flexShrink: 0, paddingHorizontal: 7, paddingVertical: 3 },
  availableBadgeText: { color: "#18794E", fontSize: 10, fontWeight: "900" },
  region: { color: "#68627D", fontSize: 13, marginTop: 5 },
  seller: { color: "#827B96", fontSize: 12, marginTop: 4 },
  catalogRating: { alignSelf: "flex-start", backgroundColor: "#FFF7E8", borderColor: "#FDE2A7", borderRadius: 8, borderWidth: 1, marginTop: 6, maxWidth: "100%", paddingHorizontal: 7, paddingVertical: 3 },
  catalogRatingText: { color: "#9A5B00", fontSize: 10, fontWeight: "900" },
  cardBottomRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8, minWidth: 0 },
  price: { color: "#166A4C", flexShrink: 0, fontSize: 17, fontWeight: "900" },
  catalogSourceBadge: { backgroundColor: "#F0EEFF", borderRadius: 9, flexShrink: 1, maxWidth: 126, paddingHorizontal: 7, paddingVertical: 4 },
  catalogSourceText: { color: "#5B4CC4", fontSize: 10, fontWeight: "900" },
  sourceButton: { alignSelf: "flex-start", marginTop: 6, maxWidth: "100%" },
  sourceButtonText: { color: "#7F1D5A", fontSize: 11, fontWeight: "800" },
  similarButton: { alignSelf: "flex-start", marginTop: 7, maxWidth: "100%" },
  similarButtonText: { color: "#155EEF", fontSize: 12, fontWeight: "750" },
  heart: { padding: 7, position: "absolute", right: 8, top: 8 },
  heartText: { color: "#98A2B3", fontSize: 27 },
  heartActive: { color: "#E31B54", fontSize: 27 },
  empty: { alignSelf: "center", color: "#667085", fontSize: 15, paddingTop: 24, textAlign: "center", width: "100%" },
  tabScroll: { width: "100%" },
  tabScrollContent: { paddingBottom: 102 },
  sellIntro: { backgroundColor: "#F8FAFC", borderColor: "#D0D5DD", borderRadius: 18, borderWidth: 1, marginTop: 10, padding: 18 },
  sellTitle: { color: "#101828", fontSize: 21, fontWeight: "800" },
  sellHint: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 7 },
  sellButton: { alignItems: "center", backgroundColor: "#155EEF", borderRadius: 13, marginTop: 18, paddingVertical: 14 },
  sellButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  boostCard: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 15 },
  boostTitle: { color: "#9A3412", fontSize: 16, fontWeight: "800" },
  boostText: { color: "#9A3412", fontSize: 13, lineHeight: 19, marginTop: 5 },
  priceRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  priceOption: { backgroundColor: "#FFFFFF", borderColor: "#FED7AA", borderRadius: 12, borderWidth: 1, flex: 1, padding: 10 },
  priceTitle: { color: "#7C2D12", fontSize: 12, fontWeight: "700" },
  priceValue: { color: "#C2410C", fontSize: 18, fontWeight: "900", marginTop: 4 },
  priceTerm: { color: "#9A3412", fontSize: 11, marginTop: 2 },
  priceDiscount: { color: "#15803D", fontSize: 12, fontWeight: "800", marginTop: 9 },
  permanentLabel: { color: "#7C2D12", fontSize: 14, fontWeight: "900", marginTop: 16 },
  comingSoon: { color: "#C2410C", fontSize: 15, fontWeight: "800", marginTop: 10 },
  emptyTab: { alignItems: "center", alignSelf: "center", flex: 1, justifyContent: "center", maxWidth: 600, paddingHorizontal: 30, width: "100%" },
  emptyTabIcon: { fontSize: 34 },
  emptyTabTitle: { color: "#101828", fontSize: 21, fontWeight: "800", marginTop: 12, textAlign: "center" },
  emptyTabText: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: "center" },
  premiumCard: { alignSelf: "stretch", backgroundColor: "#101828", borderRadius: 18, marginTop: 18, padding: 18 },
  premiumTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  premiumItem: { color: "#D0D5DD", fontSize: 13, lineHeight: 20, marginTop: 10 },
  comingSoonButton: { alignItems: "center", backgroundColor: "#344054", borderRadius: 11, marginTop: 17, paddingVertical: 12 },
  comingSoonButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  subscribeButton: { alignItems: "center", backgroundColor: "#ECFDF3", borderColor: "#ABEFC6", borderRadius: 13, borderWidth: 1, marginBottom: 84, paddingHorizontal: 13, paddingVertical: 13 },
  subscribeButtonText: { color: "#067647", fontSize: 13, fontWeight: "800", textAlign: "center" },
  detailsOverlay: { backgroundColor: "rgba(16,24,40,0.5)", flex: 1 },
  detailsScroll: { flexGrow: 1, justifyContent: "flex-end", padding: 14 },
  detailsPanel: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, maxWidth: 660, padding: 22, width: "100%" },
  detailsHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  detailsTitle: { color: "#101828", fontSize: 27, fontWeight: "900" },
  detailsPrice: { color: "#155EEF", fontSize: 19, fontWeight: "900", marginTop: 4 },
  detailsPlatePreview: { alignItems: "center", backgroundColor: "#F8FAFC", borderColor: "#344054", borderRadius: 14, borderWidth: 2, marginTop: 20, paddingHorizontal: 14, paddingVertical: 20 },
  detailsPlateValue: { color: "#101828", fontSize: 34, fontWeight: "900", letterSpacing: 1 },
  detailsPlateRegion: { color: "#475467", fontSize: 14, fontWeight: "800", marginTop: 5 },
  detailsClose: { alignItems: "center", backgroundColor: "#F2F4F7", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  detailsCloseText: { color: "#475467", fontSize: 25, lineHeight: 29 },
  detailsBlock: { borderTopColor: "#EAECF0", borderTopWidth: 1, marginTop: 18, paddingTop: 15 },
  priceHistoryBlock: { backgroundColor: "#F7F6FF", borderColor: "#DDD8FF", borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 14 },
  priceHistoryHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  priceHistoryTitle: { color: "#352F67", fontSize: 15, fontWeight: "900" },
  priceHistoryCaption: { color: "#6B5ED5", fontSize: 11, fontWeight: "800" },
  priceChart: { alignItems: "flex-end", flexDirection: "row", gap: 7, height: 124, justifyContent: "space-around", marginTop: 12 },
  priceChartColumn: { alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end", minWidth: 0 },
  priceChartValue: { color: "#5143C2", fontSize: 10, fontWeight: "800", maxWidth: "100%", textAlign: "center" },
  priceChartTrack: { backgroundColor: "#E5E2FA", borderRadius: 9, height: 78, justifyContent: "flex-end", marginTop: 5, overflow: "hidden", width: "100%" },
  priceChartBar: { backgroundColor: "#5143C2", borderRadius: 9, width: "100%" },
  priceChartDate: { color: "#716A88", fontSize: 10, fontWeight: "700", marginTop: 5 },
  priceHistoryEmpty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E0FA", borderRadius: 13, borderStyle: "dashed", borderWidth: 1, marginTop: 12, paddingVertical: 15 },
  priceHistoryEmptyValue: { color: "#5143C2", fontSize: 23, fontWeight: "900" },
  priceHistoryEmptyDate: { color: "#716A88", fontSize: 11, fontWeight: "700", marginTop: 3 },
  priceHistoryHint: { color: "#716A88", fontSize: 11, lineHeight: 16, marginTop: 11 },
  detailsLabel: { color: "#667085", fontSize: 12, fontWeight: "700", marginTop: 9 },
  detailsValue: { color: "#101828", fontSize: 15, fontWeight: "750", marginTop: 3 },
  detailsComment: { color: "#344054", fontSize: 14, lineHeight: 20, marginTop: 4 },
  verifiedSeller: { alignSelf: "flex-start", backgroundColor: "#ECFDF3", borderColor: "#ABEFC6", borderRadius: 8, borderWidth: 1, color: "#067647", fontSize: 12, fontWeight: "800", marginTop: 8, paddingHorizontal: 8, paddingVertical: 5 },
  ratingRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 12 },
  ratingPrompt: { color: "#667085", fontSize: 12, marginRight: 3 },
  ratingStar: { color: "#F79009", fontSize: 21 },
  detailsMuted: { color: "#667085", fontSize: 13, lineHeight: 19 },
  detailsSource: { alignSelf: "flex-start", backgroundColor: "#F4EBFF", borderRadius: 10, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 },
  detailsSourceText: { color: "#7F1D5A", fontSize: 13, fontWeight: "800" },
  safeContactCard: { backgroundColor: "#EFF8FF", borderColor: "#B2DDFF", borderRadius: 12, borderWidth: 1, marginTop: 15, padding: 12 },
  safeContactTitle: { color: "#175CD3", fontSize: 13, fontWeight: "800", marginBottom: 5 },
  chatOpenButton: { alignSelf: "flex-start", backgroundColor: "#5143C2", borderRadius: 10, marginTop: 12, paddingHorizontal: 13, paddingVertical: 10 },
  chatOpenButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  chatPanel: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 28, flex: 1, marginVertical: 22, maxHeight: 650, maxWidth: 660, overflow: "hidden", padding: 16, width: "94%" },
  chatHeader: { alignItems: "center", backgroundColor: "#F7F5FF", borderColor: "#E5E0FF", borderRadius: 18, borderWidth: 1, flexDirection: "row", padding: 11 },
  chatSellerMark: { alignItems: "center", backgroundColor: "#5143C2", borderRadius: 15, height: 42, justifyContent: "center", width: 42 },
  chatSellerMarkText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  chatHeaderText: { flex: 1, marginLeft: 10, minWidth: 0 },
  chatTitle: { color: "#101828", fontSize: 16, fontWeight: "900" },
  chatSubtitle: { color: "#716A88", fontSize: 12, marginTop: 2 },
  chatClose: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 30, justifyContent: "center", width: 30 },
  chatCloseText: { color: "#5143C2", fontSize: 24, fontWeight: "400", lineHeight: 27 },
  chatScroll: { backgroundColor: "#FCFCFF", borderRadius: 17, flex: 1, marginTop: 12, paddingHorizontal: 10 },
  chatMessages: { flexGrow: 1, gap: 9, justifyContent: "flex-end", paddingBottom: 12, paddingTop: 12 },
  chatEmpty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 50 },
  chatEmptyIcon: { color: "#7C6EE6", fontSize: 32, marginBottom: 8 },
  chatEmptyTitle: { color: "#101828", fontSize: 16, fontWeight: "900" },
  chatEmptyText: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center" },
  chatBubble: { alignSelf: "flex-start", backgroundColor: "#EEF1F6", borderBottomLeftRadius: 5, borderRadius: 17, maxWidth: "84%", paddingHorizontal: 13, paddingVertical: 10 },
  chatBubbleRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, maxWidth: "92%" },
  chatBubbleRowOwn: { alignSelf: "flex-end" },
  chatBubbleOwn: { alignSelf: "flex-end", backgroundColor: "#5143C2", borderBottomLeftRadius: 17, borderBottomRightRadius: 5, shadowColor: "#5143C2", shadowOpacity: 0.2, shadowRadius: 8 },
  chatBubbleText: { color: "#344054", fontSize: 14, lineHeight: 19 },
  chatBubbleTextOwn: { color: "#FFFFFF" },
  chatSafetyCard: { alignItems: "center", flexDirection: "row", marginBottom: 8, marginTop: 9 },
  chatSafetyIcon: { color: "#7C6EE6", fontSize: 17, marginRight: 6 },
  chatSafety: { color: "#716A88", flex: 1, fontSize: 11, lineHeight: 15 },
  chatInputRow: { alignItems: "flex-end", backgroundColor: "#F4F3FA", borderColor: "#E1DDF1", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 8, padding: 5 },
  chatInput: { color: "#101828", flex: 1, fontSize: 14, maxHeight: 86, minHeight: 42, paddingHorizontal: 9, paddingVertical: 9 },
  chatSend: { alignItems: "center", backgroundColor: "#5143C2", borderRadius: 13, height: 42, justifyContent: "center", width: 44 },
  chatSendText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  reportButton: { alignItems: "center", borderRadius: 12, height: 28, justifyContent: "center", width: 28 },
  reportButtonText: { color: "#98A2B3", fontSize: 17 },
  dialogsPanel: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 25, maxHeight: 620, maxWidth: 620, padding: 18, width: "94%" },
  dialogsHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  dialogsTitle: { color: "#101828", fontSize: 20, fontWeight: "900" },
  dialogsHint: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 6 },
  dialogsList: { gap: 9, paddingTop: 16 },
  dialogsEmpty: { color: "#667085", fontSize: 14, lineHeight: 21, paddingVertical: 30, textAlign: "center" },
  dialogCard: { alignItems: "center", backgroundColor: "#F8F7FC", borderColor: "#E7E3F4", borderRadius: 17, borderWidth: 1, flexDirection: "row", padding: 11 },
  dialogMark: { alignItems: "center", backgroundColor: "#5143C2", borderRadius: 15, height: 39, justifyContent: "center", width: 39 },
  dialogMarkText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  dialogBody: { flex: 1, marginHorizontal: 10, minWidth: 0 },
  dialogPlate: { color: "#101828", fontSize: 14, fontWeight: "900" },
  dialogPreview: { color: "#667085", fontSize: 12, marginTop: 3 },
  dialogTime: { color: "#98A2B3", fontSize: 11, fontWeight: "700" },
  reportPanel: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, maxWidth: 520, padding: 18, width: "92%" },
  reportInput: { borderColor: "#D0D5DD", borderRadius: 13, borderWidth: 1, color: "#101828", fontSize: 14, marginTop: 15, minHeight: 92, padding: 11, textAlignVertical: "top" },
  reportSubmit: { alignItems: "center", backgroundColor: "#D92D20", borderRadius: 13, marginTop: 12, paddingVertical: 13 },
  reportSubmitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  legalNotice: { backgroundColor: "#FFFAEB", borderColor: "#FEDF89", borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 12 },
  legalNoticeTitle: { color: "#B54708", fontSize: 13, fontWeight: "800" },
  legalNoticeText: { color: "#7A2E0E", fontSize: 12, lineHeight: 18, marginTop: 4 },
  safeDealGuide: { backgroundColor: "#EFF8FF", borderColor: "#B2DDFF", borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 12 },
  safeDealTitle: { color: "#175CD3", fontSize: 13, fontWeight: "900" },
  safeDealText: { color: "#344054", fontSize: 12, lineHeight: 18, marginTop: 5 },
  bottomNav: { backgroundColor: "#FFFFFF", borderTopColor: "#EAECF0", borderTopWidth: 1, bottom: 0, flexDirection: "row", left: 0, paddingBottom: 8, paddingHorizontal: 12, paddingTop: 8, position: "absolute", right: 0 },
  navSlot: { flex: 1, position: "relative" },
  navItem: { alignItems: "center", borderRadius: 12, paddingVertical: 5 },
  navItemActive: { backgroundColor: "#EFF4FF" },
  navDivider: { backgroundColor: "#D0D5DD", bottom: 7, position: "absolute", right: 0, top: 7, width: 1 },
  navIcon: { fontSize: 20, lineHeight: 22 },
  navText: { color: "#667085", fontSize: 11, fontWeight: "700", marginTop: 2 },
  navTextActive: { color: "#155EEF" },
  toast: { alignSelf: "center", backgroundColor: "#067647", borderRadius: 14, bottom: 82, paddingHorizontal: 18, paddingVertical: 12, position: "absolute" },
  toastText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  addButton: { backgroundColor: "#155EEF", borderRadius: 17, bottom: 18, left: 20, paddingVertical: 16, position: "absolute", right: 20, shadowColor: "#155EEF", shadowOpacity: 0.24, shadowRadius: 10 },
  addText: { color: "#FFFFFF", fontSize: 16, fontWeight: "750", textAlign: "center" },
});
