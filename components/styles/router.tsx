"use client";

import { DEFAULT_STYLE_ID, isKnownStyleId, STYLES, type StyleId } from "./registry";

export interface StyleRouterProps {
  uiStyle?: string;
}

export function StyleRouter({ uiStyle }: StyleRouterProps) {
  const id: StyleId = isKnownStyleId(uiStyle) ? uiStyle : DEFAULT_STYLE_ID;
  const Page = STYLES[id];
  return <Page />;
}
