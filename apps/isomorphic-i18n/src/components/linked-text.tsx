import { activeCountry } from "@/config/countryConfig";

/** Names linked wherever the text of an explanation mentions them: proper names, spelt the same in every language. */
const { partner } = activeCountry;
const LINKS: Record<string, string | undefined> = {
  FishBase: "https://www.fishbase.se",
  SeaLifeBase: "https://www.sealifebase.se",
  // Before its prefix: the regex takes the first name that matches.
  "IUCN Red List": "https://www.iucnredlist.org",
  IUCN: "https://www.iucnredlist.org",
  KoboToolbox: "https://www.kobotoolbox.org",
  "Pelagic Data Systems": "https://www.pelagicdata.com",
  WorldFish: "https://worldfishcenter.org",
  "Peskas Management Platform": "https://validation.peskas.org/",
  // ZAFIRI has no website: it is set in bold only.
  [partner.name]: partner.url,
};
const NAMES = new RegExp(`(${Object.keys(LINKS).join("|")})`);

/** A link out of the dashboard, bold so it stands out from the text around it. */
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="link font-semibold text-foreground"
      href={href}
      {...(href.startsWith("http") && { target: "_blank", rel: "noreferrer" })}
    >
      {children}
    </a>
  );
}

/** Text with each name in LINKS linked (split() puts the matched names at odd indices). */
export function Linked({ text }: { text?: string }) {
  return text?.split(NAMES).map((part, i) => {
    if (i % 2 === 0) return part;
    const href = LINKS[part];
    return href ? (
      <ExternalLink key={i} href={href}>
        {part}
      </ExternalLink>
    ) : (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    );
  });
}
