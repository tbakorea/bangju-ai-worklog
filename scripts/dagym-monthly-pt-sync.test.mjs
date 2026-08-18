import test from "node:test";
import assert from "node:assert/strict";

import { calendarItemToEvents, getKstMonthRangeIso } from "./dagym-monthly-pt-sync.mjs";

test("KST month range covers the exact local month", () => {
  assert.deepEqual(getKstMonthRangeIso("2026-08"), {
    startDate: "2026-07-31T15:00:00.000Z",
    endDate: "2026-08-31T14:59:59.999Z",
  });
});

test("calendar schedule creates one exact trainer event", () => {
  const events = calendarItemToEvents({
    id: "schedule-item-1",
    scheduleId: "schedule-1",
    name: "PT",
    category: "P.T",
    startAt: "2026-08-20T01:00:00.000Z",
    endAt: "2026-08-20T01:50:00.000Z",
    instructors: [{ id: "trainer-park", name: "박주홍" }],
    reservations: [{ reservedMember: { name: "테스트회원" } }],
  }, "2026-08");

  assert.equal(events.length, 1);
  assert.equal(events[0].trainerName, "박주홍");
  assert.equal(events[0].memberName, "테스트회원");
  assert.equal(events[0].sessionType, "paid");
  assert.equal(events[0].classLabel, "PT 수업");
  assert.equal(events[0].scheduledAt, "2026-08-20T01:00:00.000Z");
  assert.match(events[0].sourceKey, /^[a-f0-9]{64}$/);
});

test("calendar schedule keeps trainers separated and rejects another month", () => {
  const item = {
    id: "schedule-item-2",
    name: "PT",
    startAt: "2026-08-21T07:00:00.000Z",
    endAt: "2026-08-21T07:50:00.000Z",
    instructors: [
      { id: "trainer-hong", name: "홍현규" },
      { id: "trainer-park", name: "박주홍" },
    ],
    reservations: [{ reservedMember: { name: "테스트회원" } }],
  };
  const events = calendarItemToEvents(item, "2026-08");

  assert.deepEqual(events.map((event) => event.trainerName).sort(), ["박주홍", "홍현규"]);
  assert.notEqual(events[0].sourceKey, events[1].sourceKey);
  assert.deepEqual(calendarItemToEvents(item, "2026-09"), []);
});
