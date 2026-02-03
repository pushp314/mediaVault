
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
}) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="flex items-center justify-center gap-2 py-8">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-neutral-200 disabled:opacity-30 hover:bg-neutral-50 transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {startPage > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="w-10 h-10 rounded-xl border border-neutral-200 hover:bg-black hover:text-white transition-all text-sm font-bold"
                    >
                        1
                    </button>
                    {startPage > 2 && <span className="text-neutral-400">...</span>}
                </>
            )}

            {pages.map(page => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={clsx(
                        "w-10 h-10 rounded-xl border text-sm font-bold transition-all",
                        currentPage === page
                            ? "bg-black border-black text-white shadow-lg shadow-black/20"
                            : "border-neutral-200 hover:bg-neutral-50"
                    )}
                >
                    {page}
                </button>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="text-neutral-400">...</span>}
                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="w-10 h-10 rounded-xl border border-neutral-200 hover:bg-black hover:text-white transition-all text-sm font-bold"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-neutral-200 disabled:opacity-30 hover:bg-neutral-50 transition-colors"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
};
