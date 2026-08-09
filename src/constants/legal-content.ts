/**
 * The actual text of the Terms of Use and Privacy Policy, rendered in-app by
 * app/legal/[document].tsx.
 *
 * App Store Review Guideline 5.1.1(i) requires the privacy policy to be reachable BOTH
 * from an App Store Connect metadata URL and "within the app in an easily accessible
 * manner" - these screens satisfy the second half. The hosted URL is still mandatory
 * separately; see src/constants/legal.ts.
 *
 * Keep this honest: the guideline requires the policy to identify what is actually
 * collected. Every item below was checked against the backend's models and services
 * rather than written from a template, so it has to be revisited when data handling
 * changes - not just when someone remembers to.
 */

export type LegalSection = { heading: string; body: string };

export type LegalDocument = {
  title: string;
  /** Shown under the title - when the terms last changed. */
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const LAST_UPDATED = '9. august 2026';

export const TERMS_DOCUMENT: LegalDocument = {
  title: 'Vilkår for bruk',
  updated: LAST_UPDATED,
  intro:
    'Redely er en app for å organisere et delt hjem - oppgaver, utgifter, handleliste og chat mellom dere som bor sammen. Ved å bruke appen godtar du vilkårene under.',
  sections: [
    {
      heading: 'Kontoen din',
      body: 'Du må være minst 16 år for å opprette konto. Du er ansvarlig for aktivitet på kontoen din, og for at innholdet du legger inn ikke krenker andre eller bryter norsk lov. Du kan når som helst slette kontoen din fra Innstillinger, og all din data fjernes permanent.',
    },
    {
      heading: 'Deling i kollektivet',
      body: 'Innhold du legger inn - oppgaver, utgifter, handleliste, meldinger, navn og profilbilde - er synlig for de andre medlemmene i kollektivet ditt. Det er hele poenget med appen, men det betyr også at du bør vurdere hva du deler. Forlater du kollektivet, blir oppgaver du er tildelt fordelt på nytt til de gjenværende.',
    },
    {
      heading: 'Abonnement og betaling',
      body: 'Nye kollektiv får én gratis prøvemåned. Deretter kreves et aktivt abonnement for å legge inn nytt innhold - lesing forblir alltid åpen. Ett abonnement dekker hele kollektivet, betalt av ett medlem og delt uformelt mellom dere som dere selv ønsker. Kollektiv Grunn koster 49 kr/mnd og dekker inntil 6 medlemmer; Kollektiv Pluss koster 79 kr/mnd og dekker inntil 50.',
    },
    {
      heading: 'Fornyelse og oppsigelse',
      body: 'Abonnementet fornyes automatisk hver måned til det sies opp. Betaling belastes Apple-ID-en din ved bekreftet kjøp. Oppsigelse og endring av betalingsmåte gjøres i Apple-kontoens abonnementsinnstillinger, ikke i appen - vi har ingen mulighet til å avslutte det på dine vegne. Sier du opp, beholder dere tilgangen ut den betalte perioden.',
    },
    {
      heading: 'Utgifter mellom medlemmer',
      body: 'Utgiftsdelingen i appen er et regnskapsverktøy, ikke en betalingstjeneste. Vi holder oversikt over hvem som skylder hva, men flytter aldri penger og er ikke part i oppgjøret mellom dere.',
    },
    {
      heading: 'Ansvarsbegrensning',
      body: 'Appen leveres som den er. Vi gjør vårt beste for at den skal være tilgjengelig og at data ikke går tapt, men kan ikke garantere feilfri drift, og er ikke ansvarlige for tap som følge av nedetid, tapt data eller uenigheter mellom medlemmer i et kollektiv.',
    },
    {
      heading: 'Endringer',
      body: 'Vi kan oppdatere disse vilkårene. Ved vesentlige endringer varsler vi i appen før de trer i kraft. Fortsatt bruk etter det regnes som at du godtar de nye vilkårene.',
    },
  ],
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Personvernerklæring',
  updated: LAST_UPDATED,
  intro:
    'Vi lagrer det som trengs for at appen skal fungere - ikke mer. Vi selger aldri data, og bruker den ikke til annonsering eller sporing på tvers av apper.',
  sections: [
    {
      heading: 'Hva vi lagrer om deg',
      body: 'Navn, e-postadresse og eventuelt profilbilde og alder. E-post og navn kommer fra innloggingsmetoden du velger (Google, Apple eller e-post). Bruker du Logg inn med Apple og skjuler e-postadressen din, får vi kun Apples anonyme videresendingsadresse - vi ser aldri den ekte.',
    },
    {
      heading: 'Innhold du lager',
      body: 'Oppgaver, utgifter, handleliste, chatmeldinger og bilder du sender, samt aktivitetshistorikk og poeng. Dette lagres så lenge kontoen din finnes, og er synlig for de andre i kollektivet ditt.',
    },
    {
      heading: 'Varslinger',
      body: 'Slår du på push-varslinger, lagrer vi en varslingsnøkkel knyttet til enheten din, slik at vi kan sende varsler om oppgaver, aktivitet og utgifter. Du kan skru dem av når som helst i Innstillinger, og nøkkelen fjernes.',
    },
    {
      heading: 'Betaling',
      body: 'Kjøp håndteres av Apple. Vi mottar aldri kortnummer eller betalingsdetaljer - kun beskjed om at kollektivet har et aktivt abonnement, hvilken plan det gjelder, og når perioden utløper.',
    },
    {
      heading: 'Hvem vi deler med',
      body: 'Vi bruker Supabase (innlogging, database og bildelagring), Render (drift av serveren), RevenueCat (abonnementshåndtering) og Expo (utsending av push-varsler). De behandler data på våre vegne og har ikke lov til å bruke den til egne formål. Vi deler ikke data med noen andre, og selger den aldri.',
    },
    {
      heading: 'Sletting',
      body: 'Du kan slette kontoen din permanent fra Innstillinger. Da fjernes profilen din, meldingene dine, aktivitetshistorikken og innloggingsidentiteten din - ikke skjult eller deaktivert, men faktisk slettet. Er du siste medlem i et kollektiv, slettes kollektivet og innholdet i det også.',
    },
    {
      heading: 'Dine rettigheter',
      body: 'Du kan be om innsyn i, retting av eller sletting av data vi har om deg, og trekke tilbake samtykke ved å slette kontoen. Ta kontakt på adressen under om du ønsker noe av dette utført manuelt.',
    },
    {
      heading: 'Kontakt',
      body: 'Har du spørsmål om personvern eller ønsker å utøve rettighetene dine, kontakt oss på redelysupport@gmail.com.',
    },
  ],
};
