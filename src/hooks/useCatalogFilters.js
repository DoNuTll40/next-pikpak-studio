"use client";

import { useState } from "react";

export function useCatalogFilters(items, defaultSort) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortOverride, setSort] = useState(null);
  const sort = sortOverride ?? defaultSort;
  const search = query.trim().toLocaleLowerCase();
  const direction = sort === "asc" ? 1 : -1;

  const visible = items.filter(item =>
    item.name.toLocaleLowerCase().includes(search) &&
    (filter === "all" || (item.kind !== "folder" && Boolean(item.hasInfo) === (filter === "known")))
  ).sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") ||
    direction * a.name.localeCompare(b.name, ["th", "en"], { numeric: true }));

  return {
    query, setQuery, filter, setFilter, sort, setSort,
    located: visible.filter(item => !item.unresolved),
    unresolved: visible.filter(item => item.unresolved),
  };
}
