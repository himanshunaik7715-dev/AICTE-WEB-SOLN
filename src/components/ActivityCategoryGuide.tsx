import { AICTE_CATEGORIES } from '../constants/aicteData';

/** Public reference uses the same category catalog as certificate submission. */
export function ActivityCategoryGuide() {
  return (
    <section
      id="activity-category-guide"
      aria-labelledby="activity-category-heading"
      className="mt-12 scroll-mt-6 border border-white/15 bg-[#0d0d0d] p-5 text-white sm:p-8"
    >
      <div aria-hidden="true" className="mb-6 flex h-1 w-24">
        <span className="w-1/3 bg-[#0066b1]" />
        <span className="w-1/3 bg-[#1c69d4]" />
        <span className="w-1/3 bg-[#e22718]" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#bbbbbb]">
        Student reference
      </p>
      <h2 id="activity-category-heading" className="mt-2 text-2xl font-bold uppercase tracking-[-0.02em]">
        AICTE activity categories
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#bbbbbb]">
        Choose the category that matches your activity, then include its CAT code
        in your certificate filename before importing it from Google Drive.
      </p>

      <div className="my-6 border border-white/15 bg-black p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">How to name your PDF</h3>
        <p className="mt-2 text-sm leading-6 text-[#bbbbbb]">
          Use the semester number (01–08), category number (01–16), and a short activity title,
          separated by underscores. Keep the two-digit numbers and the .pdf extension.
        </p>
        <p className="mt-3 text-sm font-semibold text-white">Format</p>
        <code className="mt-1 block break-all text-sm text-white">
          SEM-01_CAT-06_ActivityTitle.pdf
        </code>
        <p className="mt-3 text-sm font-semibold text-white">Example: a semester 1 hackathon certificate</p>
        <code className="mt-1 block break-all text-sm text-white">
          SEM-01_CAT-06_SmartIndiaHackathon.pdf
        </code>
        <p className="mt-3 text-sm leading-6 text-[#bbbbbb]">
          Rename the file in Google Drive, set folder access to Anyone with the link – Viewer, sign in to the Student Portal, import the folder, verify the detected semester/category, and submit for CR review.
        </p>
      </div>

      <dl className="grid gap-3 md:grid-cols-2">
        {AICTE_CATEGORIES.map((category) => (
          <div key={category.id} className="min-w-0 border border-white/15 bg-black p-4">
            <dt className="flex flex-wrap items-start gap-2 text-sm font-semibold">
              <span className="shrink-0 border border-white/25 bg-[#1a1a1a] px-2 py-1 font-mono text-white">
                {category.shortCode}
              </span>
              <span className="min-w-0 flex-1 py-1">{category.title}</span>
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[#bbbbbb]">{category.description}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm leading-6 text-[#bbbbbb]">
        Unsure which category applies? Check with your CR or TGM before naming the file.
        CAT-16 is for other institution-approved activities.
      </p>
    </section>
  );
}

