import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
    const baseClass = 'skeleton';
    const variantClass = variant === 'circle' ? 'rounded-full' : 'rounded-lg';

    return (
        <div className={`${baseClass} ${variantClass} ${className}`} />
    );
};

export const DashboardSkeleton = () => (
    <div className="space-y-6 animate-fadeIn">
        <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
            ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    </div>
);

export const ListSkeleton = () => (
    <div className="space-y-4">
        <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-4 mb-6">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 w-48" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
            ))}
        </div>
    </div>
);
