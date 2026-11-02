import { Skeleton } from './_ux/ui'

/** โครงรอโหลดของทุกหน้าครู — แสดงในพื้นที่เนื้อหา เมนูข้างและแถบบนยังอยู่ (ไม่ใช้ม่านเมฆ) */
export default function TeacherLoading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <span className="sr-only">กำลังโหลด</span>
      <div className="mb-6 border-b border-[var(--c-line)] pb-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="mt-3 h-3.5 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--c-line)] bg-white p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-[var(--c-line)] bg-white">
        <div className="border-b border-[var(--c-line)] px-5 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex h-12 items-center gap-4 border-b border-[var(--c-line)] px-5 last:border-b-0">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
