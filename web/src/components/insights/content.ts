/** Shared plain language copy for How it works and About the data. No dashes in any visible text. */
export const LIMITATIONS: { title: string; body: string }[] = [
  {
    title: 'The data is one to two years old',
    body: 'CMS publishes results long after the care happened. Use this tool to see the big picture and plan, not to track this month. A hospital can run the same math on its own infection records for a monthly view.',
  },
  {
    title: 'It covers traditional Medicare patients only',
    body: 'The penalty programs only count patients in traditional Medicare (not Medicare Advantage). Patient safety events come from billing records, not from reviewing charts.',
  },
  {
    title: 'Infections to prevent is an estimate',
    body: 'We assume other hospitals stay the same and the penalty line does not move. In reality CMS resets the line every year.',
  },
  {
    title: 'We do not recreate value based purchasing points',
    body: 'That program uses extra thresholds from separate files, so we show where a hospital ranks instead of its exact points.',
  },
  {
    title: 'Small hospitals have jumpy infection rates',
    body: 'When a hospital expects only one or two infections, a single case changes its rate a lot. CMS also hides some numbers to protect privacy. We show these notes instead of hiding them.',
  },
  {
    title: 'Money at risk is a rough estimate',
    body: 'We use 1% of all Medicare inpatient payments. The real penalty applies to a narrower set of base payments, so the true amount is usually lower.',
  },
  {
    title: 'Which team owns each measure is our judgment',
    body: 'We label each measure as Nursing driven, Shared or Other and explain why. Reasonable experts could label some measures differently.',
  },
]

/** Glossary: plain name first, technical name second (docs/STYLE_GUIDE.md). */
export const GLOSSARY: { plain: string; tech: string; meaning: string }[] = [
  { plain: 'Safety score', tech: 'Total HAC Score', meaning: 'One number that sums up how often patients were harmed in the hospital compared with other hospitals. Higher is worse.' },
  { plain: 'Penalty line', tech: '75th percentile cutoff', meaning: 'The score that separates the worst quarter of hospitals from the rest. Hospitals above it lose 1% of their Medicare payments for a year.' },
  { plain: 'Above the penalty line', tech: 'Penalized (1% payment reduction)', meaning: 'CMS lowered this hospital’s Medicare payments by 1% for the year.' },
  { plain: 'Close to the line', tech: 'Within 2 infections of crossing', meaning: 'Below the line today, but two or fewer extra infections of one type would push it over.' },
  { plain: 'Below the line', tech: 'Not penalized', meaning: 'The hospital is safely below the penalty line.' },
  { plain: 'Infection rate vs expected', tech: 'Standardized Infection Ratio (SIR)', meaning: 'Infections that happened divided by infections expected for a hospital like this one. 1.0 means as expected; below 1.0 is better.' },
  { plain: 'Points above or below average', tech: 'z score', meaning: 'How far a hospital sits from the national average, in a common unit, so different measures can be added together.' },
  { plain: 'Infections to prevent', tech: 'Patients to prevent', meaning: 'How many fewer infections of one type would move a hospital below the penalty line.' },
  { plain: 'Biggest opportunity', tech: 'Tipping measure', meaning: 'The infection type where the fewest prevented cases would clear the line.' },
  { plain: 'Patient safety events', tech: 'PSI 90 composite', meaning: 'A combined rate of ten serious complications, such as pressure ulcers and falls that break a hip.' },
  { plain: 'Catheter infections', tech: 'CAUTI', meaning: 'Urinary tract infections linked to a urinary catheter.' },
  { plain: 'Central line infections', tech: 'CLABSI', meaning: 'Bloodstream infections linked to a central IV line.' },
  { plain: 'Surgical site infections', tech: 'SSI', meaning: 'Infections after colon surgery or abdominal hysterectomy.' },
  { plain: 'C. diff infections', tech: 'CDI', meaning: 'A serious gut infection that often spreads within hospitals.' },
  { plain: 'MRSA bloodstream infections', tech: 'MRSA bacteremia', meaning: 'Bloodstream infections caused by drug resistant staph bacteria.' },
  { plain: 'Nurse communication score', tech: 'HCAHPS H_COMP_1 top box', meaning: 'The percent of patients who said nurses always listened, explained and treated them with respect.' },
  { plain: 'Similar hospitals', tech: 'Peer group', meaning: 'Hospitals of a similar size, teaching role, setting and region.' },
  { plain: 'Readmission ratio', tech: 'Excess Readmission Ratio (ERR)', meaning: 'Patients who came back within 30 days compared with how many were expected. Above 1.0 means more than expected.' },
  { plain: 'Money at risk (estimate)', tech: '1% of Medicare inpatient payments', meaning: 'A rough size of what the 1% penalty could cost the hospital in a year.' },
]

/** Link to a dataset's public landing page. PDC ids look like 'xxxx-xxxx'. */
export function datasetUrl(id: string, downloadUrl: string): string {
  return /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(id) ? `https://data.cms.gov/provider-data/dataset/${id}` : downloadUrl
}
