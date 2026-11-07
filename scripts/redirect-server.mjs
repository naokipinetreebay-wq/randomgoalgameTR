/** Production shim: old host → https://tr.rojiura.app/randomgoal/… */
import { createServer } from "http";

const TARGET = "https://tr.rojiura.app";
const BASE = "/randomgoal";
const port = parseInt(process.env.PORT || "3000", 10);

function destination(reqUrl) {
  const url = new URL(reqUrl || "/", "http://localhost");
  const pathname = url.pathname;

  const withCode = pathname.match(/^\/([rd])\/([^/]+)\/?$/i);
  if (withCode) {
    const dest = new URL(`${TARGET}${BASE}/${withCode[1].toLowerCase()}/`);
    dest.searchParams.set("code", withCode[2]);
    url.searchParams.forEach((v, k) => {
      if (k !== "code") dest.searchParams.set(k, v);
    });
    return dest.toString();
  }

  const roleOnly = pathname.match(/^\/([rd])\/?$/i);
  if (roleOnly) {
    const dest = new URL(`${TARGET}${BASE}/${roleOnly[1].toLowerCase()}/`);
    dest.search = url.search;
    return dest.toString();
  }

  const rest = pathname === "" ? "/" : pathname;
  const dest = new URL(`${TARGET}${BASE}${rest === "/" ? "/" : rest}`);
  dest.search = url.search;
  return dest.toString();
}

createServer((req, res) => {
  const location = destination(req.url);
  res.writeHead(301, { Location: location, "Cache-Control": "no-store" });
  res.end();
}).listen(port, "0.0.0.0", () => {
  console.log(`randomgoal redirect → ${TARGET}${BASE}/ on :${port}`);
});
