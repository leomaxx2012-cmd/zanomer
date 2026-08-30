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
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [sort, setSort] = useState<"date" | "priceAsc" | "priceDesc">("date");
  const [platePicker, setPlatePicker] = useState<PlatePicker>(null);
  const [profileName, setProfileName] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
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
  const [isModerator, setIsModerator] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatRecipientId, setChatRecipientId] = useState("");

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

  async function openChat(listing: Plate) {
    if (!supabase) return;

    // Временный гостевой режим: для переписки не просим посетителя
    // регистрироваться. Supabase создаёт анонимную сессию, поэтому к чату
    // всё равно применяются те же правила доступа и фильтр запрещённых слов.
    if (!isSignedIn) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        setChatMessage("Гостевой чат пока не включён в базе. Включи Anonymous sign-ins в настройках Supabase.");
        setChatOpen(true);
        return;
      }
      const guestName = `Гость-${data.user.id.slice(0, 6)}`;
      setCurrentUserId(data.user.id);
      setProfileName(guestName);
      setIsSignedIn(true);
      await supabase.from("auto_profiles").upsert({ id: data.user.id, username: guestName }, { onConflict: "id" });
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
    setChatRecipientId(listing.ownerId === currentUserId ? messages.filter((item) => item.sender_id !== currentUserId).at(-1)?.sender_id ?? "" : listing.ownerId ?? "");
    setChatOpen(true);
  }

  async function sendChatMessage() {
    if (!supabase || !selectedPlate || !chatDraft.trim()) return;
    const recipientId = chatRecipientId || selectedPlate.ownerId;
    if (!recipientId) return setChatMessage("Не удалось определить получателя сообщения.");
    const { error } = await supabase.from("listing_messages").insert({ listing_id: selectedPlate.id, recipient_id: recipientId, body: chatDraft.trim() });
    if (error) return setChatMessage(error.message.includes("запрещ") ? "Сообщение содержит запрещённые слова. Измени текст." : "Не удалось отправить сообщение.");
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
      const { data, error } = await client
        .from("auto_listings")
        .select("id, owner_id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, status, featured_until")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error || !data) return;

      const ownerIds = data.map((item) => item.owner_id).filter(Boolean);
      const { data: profiles } = ownerIds.length
        ? await client.from("auto_profiles").select("id, username").in("id", ownerIds)
        : { data: [] as { id: string; username: string }[] };
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));

      const fromDatabase: Plate[] = data.map((item) => ({
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
        tag: "Объявление",
        isSiteListing: true,
        ownerId: item.owner_id,
        sellerRating: null,
        featuredUntil: item.featured_until,
      }));
      const { data: partnerData } = await client
        .from("partner_listings")
        .select("id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, tag, source_name, source_url, featured_until")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      const partners: Plate[] = (partnerData ?? []).map((item) => ({
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
        setCurrentUserId("");
        setMyListings([]); setModerationListings([]); setIsModerator(false);
        return;
      }
      setIsSignedIn(true);
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

  function toggleSaved(id: string) {
    setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function makeSearchTitle() {
    const number = `${leftLetter || "А"} ${digits || "•••"} ${rightLetters || "АА"}`;
    const code = regionCode ? ` · ${regionCode}` : "";
    return `${number}${code}${region !== "Все" ? ` · ${region}` : ""}`;
  }

  function saveCurrentSearch() {
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
  }

  function applySavedSearch(search: SavedSearch) {
    setLeftLetter(search.leftLetter);
    setRightLetters(search.rightLetters);
    setDigits(search.digits);
    setRegion(search.region);
    setRegionCode(search.regionCode);
    setVehicle(search.vehicle);
    setPriceLimit(search.priceLimit);
    setSavedSearchesOpen(false);
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
          <Pressable onPress={() => setAuthOpen((value) => !value)} style={styles.accountButton}>
            <Text style={styles.accountButtonText}>{isSignedIn ? `👤 ${profileName || "Профиль"}` : "Войти"}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {authOpen && (
        <Modal transparent animationType="slide" onRequestClose={() => setAuthOpen(false)}>
          <SafeAreaView style={styles.authOverlay}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authPanel}>
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
                </>}
              </View>}
              <Pressable onPress={async () => { if (supabase) await supabase.auth.signOut(); setProfileName(""); setIsSignedIn(false); setAuthOpen(false); }}><Text style={styles.logoutText}>Выйти из профиля</Text></Pressable>
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
          </View>
          </ScrollView>
          </SafeAreaView>
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
          ["car", "🚗"],
          ["motorcycle", "🏍️"],
          ["truck", "🚚"],
        ] as const).map(([type, icon]) => (
          <Pressable key={type} onPress={() => setVehicle(type)} style={[styles.vehicleTab, vehicle === type && styles.vehicleTabActive]}>
            <Text style={styles.vehicleIcon}>{icon}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.plateSearch}>
        <TextInput value={leftLetter} onChangeText={setLeftLetter} onFocus={() => setPlatePicker("left")} placeholder="А" placeholderTextColor="#B8C0CC" style={styles.plateInput} autoCapitalize="characters" maxLength={1} />
        <View style={styles.plateDivider} />
        <TextInput value={digits} onChangeText={setDigits} onFocus={() => setPlatePicker("digits")} placeholder="111" placeholderTextColor="#B8C0CC" style={styles.plateInput} keyboardType="default" maxLength={3} />
        <View style={styles.plateDivider} />
        <TextInput value={rightLetters} onChangeText={setRightLetters} onFocus={() => setPlatePicker("right")} placeholder="АА" placeholderTextColor="#B8C0CC" style={styles.plateInput} autoCapitalize="characters" maxLength={2} />
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

      <View style={styles.searchActions}>
        <Pressable onPress={saveCurrentSearch} style={styles.saveSearchButton}>
          <Text style={styles.saveSearchText}>☆ Сохранить поиск</Text>
        </Pressable>
        <Pressable onPress={() => setSavedSearchesOpen((value) => !value)} style={styles.savedSearchesButton}>
          <Text style={styles.savedSearchesText}>Сохранённые {savedSearches.length ? `(${savedSearches.length})` : ""}</Text>
        </Pressable>
      </View>

      {!leftLetter && !rightLetters && !digits && !regionCode && region === "Все" && priceLimit === null && specialFilters.length === 0 && !similarToId && (
        <View style={styles.featuredSection}>
          <View style={styles.featuredHeading}>
            <Text style={styles.featuredTitle}>🔥 Горячие предложения</Text>
            <Text style={styles.featuredHint}>Подняты владельцами</Text>
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

      {savedSearchesOpen && (
        <View style={styles.savedSearchesPanel}>
          <Text style={styles.savedSearchesTitle}>Сохранённые поиски</Text>
          {savedSearches.length === 0 ? (
            <Text style={styles.savedSearchesEmpty}>Настрой номер и нажми «Сохранить поиск».</Text>
          ) : (
            savedSearches.map((search) => (
              <View key={search.id} style={styles.savedSearchRow}>
                <Pressable onPress={() => applySavedSearch(search)} style={styles.savedSearchApply}>
                  <Text numberOfLines={1} style={styles.savedSearchName}>{search.title}</Text>
                  <Text style={styles.savedSearchHint}>Применить</Text>
                </Pressable>
                <Pressable onPress={() => setSavedSearches((items) => items.filter((item) => item.id !== search.id))} hitSlop={8}>
                  <Text style={styles.savedSearchRemove}>×</Text>
                </Pressable>
              </View>
            ))
          )}
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
                <TextInput value={listingLeftLetter} onFocus={() => setListingPicker("left")} onChangeText={(value) => setListingLeftLetter(value.toUpperCase().replace(/[^АВЕКМНОРСТУХ]/g, "").slice(-1))} placeholder="А" placeholderTextColor="#98A2B3" style={styles.addSmallInput} autoCapitalize="characters" maxLength={1} />
                <TextInput value={listingDigits} onFocus={() => setListingPicker("digits")} onChangeText={(value) => setListingDigits(value.replace(/\D/g, "").slice(0, 3))} placeholder="777" placeholderTextColor="#98A2B3" style={styles.addDigitsInput} keyboardType="number-pad" maxLength={3} />
                <TextInput value={listingRightLetters} onFocus={() => setListingPicker("right")} onChangeText={(value) => setListingRightLetters(value.toUpperCase().replace(/[^АВЕКМНОРСТУХ]/g, "").slice(0, 2))} placeholder="АА" placeholderTextColor="#98A2B3" style={styles.addLettersInput} autoCapitalize="characters" maxLength={2} />
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
        {(activeTab === "favorites" || similarTo) && <Text numberOfLines={1} style={[styles.sectionTitle, styles.listTitle, activeTab === "favorites" && styles.favoritesTitle]}>{activeTab === "favorites" ? "Избранные номера" : `Похожие на ${similarTo.value}`}</Text>}
        {activeTab === "buy" && <View style={styles.resultCount}><Text style={styles.resultCountText}>Найдено: {visiblePlates.length}</Text></View>}
      </View>
      {activeTab === "buy" && <View style={styles.listFilters}>
        <Pressable onPress={() => setPlatePicker("region")} style={[styles.listFilterButton, !!regionCode && styles.listFilterButtonActive]}><Text style={[styles.listFilterButtonText, !!regionCode && styles.listFilterButtonTextActive]}>⌖ {selectedRegionFilterLabel}</Text></Pressable>
        {[[null, "Любая цена"], [100000, "до 100 тыс."], [300000, "до 300 тыс."], [1000000, "до 1 млн"]].map(([limit, label]) => <Pressable key={label} onPress={() => setPriceLimit(limit as number | null)} style={[styles.listFilterButton, priceLimit === limit && styles.listFilterButtonActive]}><Text style={[styles.listFilterButtonText, priceLimit === limit && styles.listFilterButtonTextActive]}>₽ {label}</Text></Pressable>)}
      </View>}
      {similarTo && (
        <Pressable onPress={() => setSimilarToId(null)} style={styles.clearSimilarButton}>
          <Text style={styles.clearSimilarText}>Показать все номера</Text>
        </Pressable>
      )}

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
                <Text style={styles.plateValue}>{item.value}</Text>
                <Text style={styles.plateRegion}>{item.region.split(" · ")[1]}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTopRow}>
                  <Text numberOfLines={1} style={styles.tag}>{item.tag}</Text>
                  {!!item.sourceUrl && <View style={styles.availableBadge}><Text style={styles.availableBadgeText}>В наличии</Text></View>}
                </View>
                <Text style={styles.region}>{item.region}</Text>
                <Text style={styles.seller}>Продавец: {item.seller} · {item.createdAt}</Text>
                <View style={styles.cardBottomRow}>
                  <Text style={styles.price}>{item.price}</Text>
                  <View style={styles.catalogSourceBadge}><Text style={styles.catalogSourceText}>{item.sourceUrl ? "Источник проверен" : "Объявление сайта"}</Text></View>
                </View>
                {!!item.sourceUrl && <Pressable onPress={() => Linking.openURL(item.sourceUrl!)} style={styles.sourceButton}>
                  <Text style={styles.sourceButtonText}>Открыть объявление ↗</Text>
                </Pressable>}
                {activeTab === "buy" && <Pressable onPress={() => setSimilarToId(item.id)} style={styles.similarButton}>
                  <Text style={styles.similarButtonText}>Похожие номера ›</Text>
                </Pressable>}
              </View>
              <Pressable onPress={() => toggleSaved(item.id)} hitSlop={10} style={styles.heart}>
                <Text style={isSaved ? styles.heartActive : styles.heartText}>{isSaved ? "♥" : "♡"}</Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{activeTab === "favorites" ? "В избранном пока нет номеров." : "Номеров с такими параметрами пока нет. Попробуй изменить поиск."}</Text>}
      />
      {activeTab === "favorites" && visiblePlates.length > 0 && <Pressable onPress={() => { setSubscribedNumbers(saved); setSubscriptionToast(true); }} style={styles.subscribeButton}>
        <Text style={styles.subscribeButtonText}>{subscribedNumbers.length ? "✓ Подписка включена" : "🔔 Сообщить, когда номер появится в продаже"}</Text>
      </Pressable>}
      </>}

      </ScrollView>

      <Modal visible={!!selectedPlate} transparent animationType="slide" onRequestClose={() => setSelectedPlate(null)}>
        <SafeAreaView style={styles.detailsOverlay}>
          <ScrollView contentContainerStyle={styles.detailsScroll}>
            <View style={styles.detailsPanel}>
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
                <Text style={styles.detailsLabel}>Дата размещения</Text><Text style={styles.detailsValue}>{selectedPlate?.createdAt}</Text>
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
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={chatOpen} transparent animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <SafeAreaView style={styles.detailsOverlay}>
          <View style={styles.chatPanel}>
            <View style={styles.detailsHeader}><View><Text style={styles.detailsTitle}>Чат по объявлению</Text><Text style={styles.detailsMuted}>{selectedPlate?.value} · {selectedPlate?.seller}</Text></View><Pressable onPress={() => setChatOpen(false)} style={styles.detailsClose}><Text style={styles.detailsCloseText}>×</Text></Pressable></View>
            <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatMessages}>
              {chatMessages.length === 0 ? <Text style={styles.detailsMuted}>Пока нет сообщений. Напиши продавцу первым.</Text> : chatMessages.map((message) => <Pressable key={message.id} onPress={() => { if (selectedPlate?.ownerId === currentUserId && message.sender_id !== currentUserId) setChatRecipientId(message.sender_id); }} style={[styles.chatBubble, message.sender_id === currentUserId && styles.chatBubbleOwn]}><Text style={[styles.chatBubbleText, message.sender_id === currentUserId && styles.chatBubbleTextOwn]}>{message.body}</Text></Pressable>)}
            </ScrollView>
            <Text style={styles.chatSafety}>{selectedPlate?.ownerId === currentUserId ? "Нажми на сообщение покупателя, чтобы выбрать его для ответа. Не отправляй документы, банковские данные, номера карт или ссылки." : "Не отправляй документы, банковские данные, номера карт или ссылки."}</Text>
            {!!chatMessage && <Text style={styles.authMessage}>{chatMessage}</Text>}
            <View style={styles.chatInputRow}><TextInput value={chatDraft} onChangeText={setChatDraft} placeholder="Сообщение" placeholderTextColor="#98A2B3" style={styles.chatInput} multiline /><Pressable onPress={sendChatMessage} style={styles.chatSend}><Text style={styles.chatSendText}>Отправить</Text></Pressable></View>
          </View>
        </SafeAreaView>
      </Modal>

      <View style={styles.bottomNav}>
        {([
          ["buy", "⌕", "Купить", "#155EEF"],
          ["sell", "＋", "Продать", "#F04438"],
          ["favorites", "♡", "Избранное", "#D92D20"],
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
  managementHint: { color: "#716A88", fontSize: 12, lineHeight: 17, marginTop: 6 },
  managementCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E0F3", borderRadius: 11, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 8, padding: 10 },
  managementPlate: { color: "#24213E", fontSize: 14, fontWeight: "900" },
  managementMeta: { color: "#716A88", fontSize: 11, marginTop: 2 },
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
  vehicleTabs: { flexDirection: "row", gap: 9, marginBottom: 13 },
  vehicleTab: { alignItems: "center", backgroundColor: "#F2F4F7", borderColor: "#E2E8F0", borderRadius: 19, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  vehicleTabActive: { backgroundColor: "#5143C2", borderColor: "#5143C2" },
  vehicleIcon: { fontSize: 20 },
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
  card: { alignItems: "center", backgroundColor: "#FFFEFF", borderColor: "#E5E1F2", borderRadius: 24, borderWidth: 1, flexDirection: "row", minHeight: 136, padding: 18, shadowColor: "#5143C2", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.1, shadowRadius: 16 },
  plate: { alignItems: "center", backgroundColor: "#F9F8FF", borderColor: "#4A4569", borderRadius: 12, borderWidth: 2, justifyContent: "center", minHeight: 70, minWidth: 138, paddingHorizontal: 9, shadowColor: "#2D2857", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 4 },
  plateValue: { color: "#24213E", fontSize: 21, fontWeight: "900" },
  plateRegion: { color: "#605A78", fontSize: 12, fontWeight: "800", marginTop: 2 },
  cardInfo: { flex: 1, marginLeft: 15, minWidth: 0 },
  cardTopRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  tag: { color: "#5143C2", fontSize: 15, fontWeight: "850" },
  availableBadge: { backgroundColor: "#E8F8F0", borderColor: "#BAE9D1", borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  availableBadgeText: { color: "#18794E", fontSize: 10, fontWeight: "900" },
  region: { color: "#68627D", fontSize: 13, marginTop: 5 },
  seller: { color: "#827B96", fontSize: 12, marginTop: 4 },
  cardBottomRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  price: { color: "#166A4C", fontSize: 17, fontWeight: "900" },
  catalogSourceBadge: { backgroundColor: "#F0EEFF", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 },
  catalogSourceText: { color: "#5B4CC4", fontSize: 10, fontWeight: "900" },
  sourceButton: { alignSelf: "flex-start", marginTop: 6 },
  sourceButtonText: { color: "#7F1D5A", fontSize: 11, fontWeight: "800" },
  similarButton: { alignSelf: "flex-start", marginTop: 7 },
  similarButtonText: { color: "#155EEF", fontSize: 12, fontWeight: "750" },
  heart: { alignSelf: "flex-start", paddingLeft: 8 },
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
  detailsMuted: { color: "#667085", fontSize: 13, lineHeight: 19 },
  detailsSource: { alignSelf: "flex-start", backgroundColor: "#F4EBFF", borderRadius: 10, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 },
  detailsSourceText: { color: "#7F1D5A", fontSize: 13, fontWeight: "800" },
  safeContactCard: { backgroundColor: "#EFF8FF", borderColor: "#B2DDFF", borderRadius: 12, borderWidth: 1, marginTop: 15, padding: 12 },
  safeContactTitle: { color: "#175CD3", fontSize: 13, fontWeight: "800", marginBottom: 5 },
  chatOpenButton: { alignSelf: "flex-start", backgroundColor: "#5143C2", borderRadius: 10, marginTop: 12, paddingHorizontal: 13, paddingVertical: 10 },
  chatOpenButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  chatPanel: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, flex: 1, marginVertical: 22, maxHeight: 620, maxWidth: 660, padding: 18, width: "94%" },
  chatScroll: { flex: 1, marginTop: 16 },
  chatMessages: { gap: 8, paddingBottom: 10 },
  chatBubble: { alignSelf: "flex-start", backgroundColor: "#F2F4F7", borderRadius: 13, maxWidth: "84%", paddingHorizontal: 11, paddingVertical: 9 },
  chatBubbleOwn: { alignSelf: "flex-end", backgroundColor: "#5143C2" },
  chatBubbleText: { color: "#344054", fontSize: 13, lineHeight: 18 },
  chatBubbleTextOwn: { color: "#FFFFFF" },
  chatSafety: { color: "#716A88", fontSize: 11, lineHeight: 15, marginBottom: 7 },
  chatInputRow: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  chatInput: { backgroundColor: "#F8FAFC", borderColor: "#D0D5DD", borderRadius: 11, borderWidth: 1, color: "#101828", flex: 1, fontSize: 13, maxHeight: 86, minHeight: 42, paddingHorizontal: 10, paddingVertical: 9 },
  chatSend: { alignItems: "center", backgroundColor: "#5143C2", borderRadius: 10, justifyContent: "center", minHeight: 42, paddingHorizontal: 10 },
  chatSendText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  legalNotice: { backgroundColor: "#FFFAEB", borderColor: "#FEDF89", borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 12 },
  legalNoticeTitle: { color: "#B54708", fontSize: 13, fontWeight: "800" },
  legalNoticeText: { color: "#7A2E0E", fontSize: 12, lineHeight: 18, marginTop: 4 },
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
