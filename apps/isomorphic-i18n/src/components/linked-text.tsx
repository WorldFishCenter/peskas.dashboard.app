import { useMemo } from "react";
import { Link } from "react-router";
import { METHODS, type Method } from "@repo/domain/metrics";
import { activeCountry } from "@/config/countryConfig";
import { pages } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { METHOD_TEXT } from "@/lib/dashboard/metrics";

/** FAO's OPEN ARTFISH toolkit, the reference for the FAO ARTFISH method (its FAO Open Knowledge record). */
export const ARTFISH_TOOLKIT = "https://openknowledge.fao.org/handle/20.500.14283/i7680en";

/** Names linked wherever the text of an explanation mentions them: proper names, spelt the same in every language. */
const { partner } = activeCountry;
const LINKS: Record<string, string | undefined> = {
  "OPEN ARTFISH": ARTFISH_TOOLKIT,
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

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A name as a pattern whose first letter takes either case, as it starts a sentence or not. */
const anyCase = (name: string) =>
  `[${name[0].toUpperCase()}${name[0].toLowerCase()}]${escape(name.slice(1))}`;

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

/**
 * A method's name in its colour (`METHOD_TEXT`), linked to its card in Data
 * and methods; unlinked where `link` is false, as inside that card.
 */
function MethodName({
  method,
  link = true,
  children,
}: {
  method: Method;
  link?: boolean;
  children: React.ReactNode;
}) {
  const scoped = useScopedHref();
  const style = { color: METHOD_TEXT[method] };
  return link ? (
    <Link
      to={`${scoped(pages.about.path)}#method-${method}`}
      style={style}
      // The `link` underline, in the method's colour rather than the text's.
      className="link font-medium decoration-current/40 hover:decoration-current"
    >
      {children}
    </Link>
  ) : (
    <span style={style} className="font-medium">
      {children}
    </span>
  );
}

/**
 * Text with each name in LINKS linked, and each method named in the page
 * language (its full name, "FAO ARTFISH" or "ARTFISH") set as a `MethodName`.
 * split() puts the matched names at odd indices.
 */
export function Linked({ text, methodLinks = true }: { text?: string; methodLinks?: boolean }) {
  const { t } = useT();
  const { names, methodOf } = useMemo(() => {
    const full = METHODS.map((m): [string, Method] => [t(`text-method-${m}`), m]);
    // Full names first: at the same start a longer name wins ("FAO ARTFISH method" over "FAO ARTFISH").
    const patterns = [
      ...Object.keys(LINKS).map(escape),
      ...full.map(([name]) => anyCase(name)),
      "FAO ARTFISH",
      "ARTFISH",
    ];
    return {
      names: new RegExp(`(${patterns.join("|")})`),
      // Each spelling's method, whatever the case of its first letter.
      methodOf: new Map<string, Method>([
        ...full.map(([name, m]): [string, Method] => [name.toLowerCase(), m]),
        ["fao artfish", "artfish"],
        ["artfish", "artfish"],
      ]),
    };
  }, [t]);

  return text?.split(names).map((part, i) => {
    if (i % 2 === 0) return part;
    const method = methodOf.get(part.toLowerCase());
    if (method) {
      return (
        <MethodName key={i} method={method} link={methodLinks}>
          {part}
        </MethodName>
      );
    }
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
