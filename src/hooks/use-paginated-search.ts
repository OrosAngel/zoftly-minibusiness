import { useState, useMemo, useEffect } from "react";

interface UsePaginatedSearchOptions {
    itemsPerPage?: number;
}

/**
 * Reusable hook for filtered + paginated lists.
 * Handles search state, pagination state, and memoized filtering/slicing.
 */
export function usePaginatedSearch<T>(
    items: T[],
    searchFn: (item: T, query: string) => boolean,
    options: UsePaginatedSearchOptions = {}
) {
    const { itemsPerPage = 20 } = options;
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const filteredItems = useMemo(() => {
        if (!search.trim()) return items;
        const lowerSearch = search.toLowerCase();
        return items.filter((item) => searchFn(item, lowerSearch));
    }, [items, search, searchFn]);

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const paginatedItems = useMemo(
        () =>
            filteredItems.slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage
            ),
        [filteredItems, currentPage, itemsPerPage]
    );

    return {
        search,
        setSearch,
        currentPage,
        setCurrentPage,
        totalPages,
        filteredItems,
        paginatedItems,
    };
}
