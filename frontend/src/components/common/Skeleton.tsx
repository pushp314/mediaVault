
import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return (
        <div className={clsx("animate-pulse bg-neutral-200 rounded-lg", className)} />
    );
};

export const MediaCardSkeleton = () => (
    <div className="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden">
        <Skeleton className="aspect-square rounded-none" />
        <div className="p-6 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex justify-between">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/4" />
            </div>
        </div>
    </div>
);
