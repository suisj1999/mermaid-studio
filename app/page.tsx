import { StyleRouter } from "~/components/styles/router";

interface SearchParams {
  "ui-style"?: string;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { "ui-style": uiStyle } = await searchParams;
  return <StyleRouter uiStyle={uiStyle} />;
}
