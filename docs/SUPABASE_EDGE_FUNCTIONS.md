# Jak nasadit / spustit Supabase Edge Functions (registrace uživatelů)

Registrace nových uživatelů v aplikaci vyžaduje **Edge Function** `create-user`. Tento návod popisuje, jak ji nasadit nebo spustit lokálně.

> **Tip:** Pokud máte v `.env` URL ve tvaru `https://xxxxx.supabase.co`, používáte **cloud** (Varianta A). Pro lokální vývoj viz Varianta B.

---

## Kam psát příkazy?

Příkazy se píší do **terminálu** (příkazové řádky):

1. **V Cursoru / VS Code**: Otevřete terminál pomocí **Ctrl + `** (backtick) nebo menu **Terminal → New Terminal**.
2. **Nebo**: Otevřete **PowerShell** nebo **Command Prompt** (Start → vyhledat „PowerShell“).

Důležité: vždy nejdřív přejděte do složky projektu:

```
cd "C:\Users\vojta\Desktop\Nokturo App"
```

Všechny níže uvedené příkazy spouštějte z této složky (pokud není řečeno jinak).

---

## Krok 0: Nainstalovat Supabase CLI

1. Otevřete terminál (viz výše).
2. Zkontrolujte, jestli máte Supabase CLI:

   ```
   supabase --version
   ```

3. Pokud příkaz nefunguje, nainstalujte Supabase CLI:

   - **Přes npm** (doporučeno, pokud máte Node.js):
     ```
     npm install -g supabase
     ```
   - Nebo stáhněte z [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli).

4. Ověřte instalaci znovu: `supabase --version`.

---

## Varianta A: Supabase v cloudu (produkce / staging)

Používáte reálný Supabase projekt na supabase.com (např. `https://xxxxx.supabase.co`).

### A1. Přihlášení do Supabase

1. V terminálu v projektu spusťte:

   ```
   supabase login
   ```

2. Otevře se prohlížeč – přihlaste se účtem Supabase.
3. Po přihlášení se vraťte do terminálu.

### A2. Propojení projektu

1. Jděte na [supabase.com/dashboard](https://supabase.com/dashboard), vyberte svůj projekt.
2. V menu vlevo: **Project Settings** → **General**.
3. Zkopírujte **Reference ID** (např. `abcdefghijklmnop`).
4. V terminálu spusťte:

   ```
   supabase link --project-ref VAS_REFERENCE_ID
   ```

   (Nahraďte `VAS_REFERENCE_ID` skutečným ID projektu.)

5. Pokud se zeptá na heslo k databázi – zadejte to, které máte v Supabase (Project Settings → Database).

### A3. Nasazení Edge Function

1. V terminálu (stále ve složce projektu):

   ```
   supabase functions deploy create-user
   ```

2. Počkejte na dokončení. Mělo by se objevit potvrzení, že funkce byla nasazena.
3. Registrace v aplikaci by teď měla fungovat.

---

## Varianta B: Supabase lokálně (vývoj)

Běží celý Supabase na vašem počítači – vhodné pro vývoj.

### B1. Kontrola, jestli máte Docker

Supabase lokálně potřebuje **Docker Desktop**.

1. Nainstalujte [Docker Desktop](https://www.docker.com/products/docker-desktop/) pro Windows.
2. Nainstalujte a spusťte Docker.
3. Ověřte v terminálu: `docker --version`.

### B2. Spuštění Supabase lokálně

1. V terminálu v projektu:

   ```
   cd "C:\Users\vojta\Desktop\Nokturo App"
   supabase start
   ```

2. Při prvním spuštění může stahování trvat několik minut.
3. Na konci se zobrazí výstup podobný tomuto:

   ```
   API URL: http://127.0.0.1:54321
   ...
   ```

   Zapište si **API URL** (obvykle `http://127.0.0.1:54321`).

### B3. Spuštění Edge Functions

1. Otevřete **další terminál** (nebo nové okno) – původní nechte běžet.
2. V novém terminálu:

   ```
   cd "C:\Users\vojta\Desktop\Nokturo App"
   supabase functions serve
   ```

3. Mělo by se objevit např. „Serving functions on http://127.0.0.1:54321/functions/v1/“.
4. Tento terminál nechte spuštěný.

### B4. Nastavení .env pro lokální Supabase

1. Ve složce projektu zkontrolujte soubor `.env`:
   - Pokud neexistuje, zkopírujte `.env.example` a přejmenujte na `.env`.
2. Otevřete `.env` v editoru.
3. Nastavte:

   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<váš lokální anon key>
   ```

4. **Lokální anon key** získáte:
   - Spusťte `supabase status` v terminálu (po `supabase start`).
   - V výstupu najděte `anon key` a zkopírujte ho.

### B5. Spuštění aplikace

1. V dalším terminálu v projektu spusťte:

   ```
   npm run dev
   ```

2. Otevřete aplikaci v prohlížeči (obvykle http://localhost:5173).
3. Registrace by měla fungovat, pokud běží `supabase start` i `supabase functions serve`.

---

## Shrnutí – co musí běžet

| Scénář | Co musí běžet |
|--------|----------------|
| **Cloud** | Nasazená funkce (`supabase functions deploy create-user`) + aplikace |
| **Lokálně** | `supabase start` + `supabase functions serve` + `npm run dev` |

---

## Časté problémy

### „supabase: command not found“ / „supabase není rozpoznán“
- Supabase CLI není nainstalované nebo není v PATH.
- Zkuste: `npm install -g supabase` a restartovat terminál.

### „Failed to send a request to the Edge Function“
- Funkce není nasazená (cloud) nebo není spuštěná (lokálně).
- Kontrola u cloudu: `supabase functions list`.
- Kontrola lokálně: běží terminál s `supabase functions serve`?

### „Edge Function returned a non-2xx status code“
Funkce běží, ale vrací chybu. Aplikace by měla zobrazit konkrétní zprávu. Časté příčiny:

| Zpráva | Příčina | Řešení |
|--------|---------|--------|
| Unauthorized / Session expired | Neplatný nebo vypršený token | Odhlaste se a přihlaste znovu |
| Forbidden: only founder can create users | Přihlášený uživatel není founder | V databázi nastavte `profiles.role = 'founder'` pro váš účet |
| Email is required | Chybí e-mail v požadavku | Zkontrolujte formulář |
| User already registered / duplicate | E-mail už existuje | Použijte jiný e-mail |

**Jak nastavit founder:** V Supabase Dashboard → SQL Editor spusťte:
```sql
UPDATE public.profiles SET role = 'founder' WHERE id = 'VÁŠ_USER_UUID';
```
(UUID získáte z Authentication → Users.)

### Lokálně: aplikace se připojuje na cloud místo na localhost
- Zkontrolujte `.env` – `VITE_SUPABASE_URL` má být `http://127.0.0.1:54321`.
- Po změně `.env` restartujte `npm run dev`.

---

## Stručný checklist před registrací

- [ ] Supabase CLI nainstalované (`supabase --version` funguje)
- [ ] **Cloud**: `supabase link` + `supabase functions deploy create-user`
- [ ] **Lokálně**: Docker běží, `supabase start`, `supabase functions serve`, `.env` s lokální URL
- [ ] Aplikace běží (`npm run dev`)
