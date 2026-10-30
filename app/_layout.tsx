import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import VercelAnalytics from "../lib/vercel-analytics";
import YandexMetrika from "../lib/yandex-metrika";
import { ResponsiveTypography } from "../components/ResponsiveText";

export default function RootLayout() {
  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="ru" />
        <title>Красивые номера на авто, мото и прицепы — ЗаНомером</title>
      </Head>
      <VercelAnalytics />
      <YandexMetrika />
      <StatusBar style="dark" />
      <ResponsiveTypography><Stack screenOptions={{ headerShown: false }} /></ResponsiveTypography>
    </>
  );
}
