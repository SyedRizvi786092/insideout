import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div className={cn('px-4 py-4 max-w-lg mx-auto w-full', className)}>
      {children}
    </div>
  );
}

export { PageContainer };
