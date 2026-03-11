// @ts-nocheck
import jwt from "jsonwebtoken";

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CAMPUS_ADMIN: "CAMPUS_ADMIN",
  VENDOR_MANAGER: "VENDOR_MANAGER",
  KITCHEN_STAFF: "KITCHEN_STAFF",
};

const ORDER_STATUSES = ["Pending", "Preparing", "Ready", "Collected"];

const STATUS_SEQUENCE = {
  Pending: "Preparing",
  Preparing: "Ready",
  Ready: "Collected",
  Collected: null,
};

const ORDER_PRIORITY = {
  HIGH: "High",
  NORMAL: "Normal",
};

const PAYMENT_MODES = ["UPI", "Card", "Cash", "Wallet"];

const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;
const ADMIN_JWT_ISSUER = "canteen-connect-admin";
const ADMIN_JWT_AUDIENCE = "canteen-admin-app";
const isProduction = process.env.NODE_ENV === "production";
const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET ||
  (!isProduction ? process.env.SESSION_SECRET || "dev-admin-secret-change-me" : "");
if (!ADMIN_JWT_SECRET) {
  throw new Error("ADMIN_JWT_SECRET must be set in production");
}
let idCounter = 5000;

const TENANTS = [
  { id: "northbridge", name: "Northbridge Institute of Technology", region: "Vijayawada" },
  { id: "hillside", name: "Hillside School of Management", region: "Hyderabad" },
  { id: "lakeview", name: "Lakeview Medical College", region: "Visakhapatnam" },
];

const OUTLET_SEED = [
  {
    id: "outlet-nb-1",
    tenantId: "northbridge",
    name: "Central Food Court",
    vendorName: "Annapurna Foods Pvt Ltd",
    commissionRate: 11,
    status: "Active",
  },
  {
    id: "outlet-nb-2",
    tenantId: "northbridge",
    name: "Hostel Mess Block A",
    vendorName: "Campus Kitchen Services",
    commissionRate: 9,
    status: "Active",
  },
  {
    id: "outlet-hs-1",
    tenantId: "hillside",
    name: "North Courtyard Cafe",
    vendorName: "Metro Canteens",
    commissionRate: 10,
    status: "Active",
  },
  {
    id: "outlet-hs-2",
    tenantId: "hillside",
    name: "Library Quick Bites",
    vendorName: "Metro Canteens",
    commissionRate: 12,
    status: "Active",
  },
  {
    id: "outlet-lv-1",
    tenantId: "lakeview",
    name: "Clinical Wing Cafeteria",
    vendorName: "Healthcare Dining Co",
    commissionRate: 10,
    status: "Active",
  },
  {
    id: "outlet-lv-2",
    tenantId: "lakeview",
    name: "Student Commons Cafe",
    vendorName: "Harbor Hospitality",
    commissionRate: 13,
    status: "Inactive",
  },
];

const USER_SEED = [
  {
    id: "user-super-1",
    tenantId: null,
    tenantAccess: ["northbridge", "hillside", "lakeview"],
    name: "Aarav Nair",
    email: "super.admin@smartcampus.io",
    password: "Secure@123",
    role: ROLES.SUPER_ADMIN,
    status: "Active",
    assignedOutletIds: [],
  },
  {
    id: "user-campus-nb-1",
    tenantId: "northbridge",
    tenantAccess: ["northbridge"],
    name: "Nisha Varma",
    email: "campus.admin@northbridge.edu",
    password: "Secure@123",
    role: ROLES.CAMPUS_ADMIN,
    status: "Active",
    assignedOutletIds: [],
  },
  {
    id: "user-vendor-nb-1",
    tenantId: "northbridge",
    tenantAccess: ["northbridge"],
    name: "Ravi Menon",
    email: "vendor.manager@northbridge.edu",
    password: "Secure@123",
    role: ROLES.VENDOR_MANAGER,
    status: "Active",
    assignedOutletIds: ["outlet-nb-1", "outlet-nb-2"],
  },
  {
    id: "user-kitchen-nb-1",
    tenantId: "northbridge",
    tenantAccess: ["northbridge"],
    name: "Sowmya Das",
    email: "kitchen.staff@northbridge.edu",
    password: "Secure@123",
    role: ROLES.KITCHEN_STAFF,
    status: "Active",
    assignedOutletIds: ["outlet-nb-1"],
  },
];

const MENU_ITEMS = [
  { name: "Veg Fried Rice", price: 110 },
  { name: "Egg Fried Rice", price: 130 },
  { name: "Chicken Fried Rice", price: 150 },
  { name: "Gobi Fried Rice", price: 125 },
  { name: "Veg Noodles", price: 105 },
  { name: "Egg Noodles", price: 125 },
  { name: "Chicken Noodles", price: 145 },
  { name: "Gobi Noodles", price: 120 },
  { name: "Veg Puff", price: 35 },
  { name: "Egg Puff", price: 45 },
  { name: "Chicken Puff", price: 55 },
  { name: "Cola (300ml)", price: 40 },
  { name: "Lemon Soda", price: 35 },
  { name: "Orange Fizz", price: 40 },
  { name: "Mango Drink", price: 45 },
];

let outletsDb = OUTLET_SEED.map((outlet) => ({ ...outlet }));
let usersDb = USER_SEED.map((user) => ({ ...user }));
let ordersDb = seedOrders();

let settingsDb = {
  northbridge: {
    campusName: "Northbridge Institute of Technology",
    logoName: "northbridge_seal.png",
    theme: "light",
    taxRate: 5,
    serviceChargeEnabled: true,
    serviceChargeRate: 2,
  },
  hillside: {
    campusName: "Hillside School of Management",
    logoName: "hillside_identity.png",
    theme: "light",
    taxRate: 5,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
  },
  lakeview: {
    campusName: "Lakeview Medical College",
    logoName: "lakeview_brandmark.png",
    theme: "dark",
    taxRate: 5,
    serviceChargeEnabled: true,
    serviceChargeRate: 1.5,
  },
};

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(list) {
  return list[randomInt(0, list.length - 1)];
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
}

function toPublicUser(user) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function toAdminSessionFromJwt(token, decoded) {
  if (!decoded || typeof decoded !== "object") return null;
  const role = normalizeText(decoded.role);
  const userId = normalizeText(decoded.sub);

  if (!userId || !Object.values(ROLES).includes(role)) {
    return null;
  }

  const tenantId = decoded.tenantId ? normalizeText(decoded.tenantId) : null;
  const tenantAccess = uniqueStrings(decoded.tenantAccess);
  if (tenantId && !tenantAccess.includes(tenantId)) {
    tenantAccess.push(tenantId);
  }

  let selectedTenantId = decoded.selectedTenantId
    ? normalizeText(decoded.selectedTenantId)
    : null;
  if (selectedTenantId && !tenantAccess.includes(selectedTenantId)) {
    selectedTenantId = tenantAccess[0] ?? tenantId ?? null;
  }

  return {
    token,
    userId,
    role,
    tenantId,
    tenantAccess,
    selectedTenantId,
  };
}

function ensureTenant(tenantId) {
  if (!tenantId) {
    return uniqueStrings(outletsDb.map((outlet) => outlet.tenantId));
  }
  return [String(tenantId)];
}

function isKnownTenant(tenantId) {
  return TENANTS.some((tenant) => tenant.id === tenantId);
}

function normalizeStatus(value) {
  return String(value).toLowerCase() === "inactive" ? "Inactive" : "Active";
}

function normalizeCommissionRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function sanitizeAssignedOutletIds(tenantId, assignedOutletIds) {
  const allowedOutletIds = new Set(scopedOutlets(tenantId).map((outlet) => outlet.id));
  return uniqueStrings(assignedOutletIds).filter((outletId) => allowedOutletIds.has(outletId));
}

function getAccessibleTenants(tenantAccess) {
  const allowed = new Set(uniqueStrings(tenantAccess));
  return TENANTS.filter((tenant) => allowed.has(tenant.id));
}

function toDate(value) {
  return new Date(value);
}

function isSameDay(dateA, dateB) {
  return dateA.toDateString() === dateB.toDateString();
}

function inLastDays(date, days) {
  const now = Date.now();
  return now - date.getTime() <= days * DAY_MS;
}

function buildItems() {
  const count = randomInt(1, 3);
  const items = [];
  let total = 0;

  for (let idx = 0; idx < count; idx += 1) {
    const selected = randomPick(MENU_ITEMS);
    const qty = randomInt(1, 2);
    total += selected.price * qty;
    items.push({ name: selected.name, qty, unitPrice: selected.price, lineTotal: selected.price * qty });
  }

  return { items, total };
}

function seedOrders() {
  const studentNames = [
    "Ishaan Kumar",
    "Meera Reddy",
    "Karthik Rao",
    "Aisha Khan",
    "Dinesh Patel",
    "Naveen Chandra",
    "Priya Iyer",
    "Rahul Deshmukh",
  ];

  const weightedStatuses = [
    "Collected",
    "Collected",
    "Collected",
    "Ready",
    "Preparing",
    "Pending",
  ];

  const orders = [];

  outletsDb.forEach((outlet) => {
    for (let index = 0; index < 28; index += 1) {
      const { items, total } = buildItems();
      const createdAt = new Date(Date.now() - randomInt(8, 48 * 60) * 60 * 1000);
      const status = randomPick(weightedStatuses);
      const paymentMode = randomPick(PAYMENT_MODES);
      const taxAmount = Math.round(total * 0.05);
      const serviceCharge = Math.round(total * (Math.random() > 0.5 ? 0.02 : 0));
      const amount = total + taxAmount + serviceCharge;

      orders.push({
        id: nextId("order"),
        tenantId: outlet.tenantId,
        outletId: outlet.id,
        outletName: outlet.name,
        vendorName: outlet.vendorName,
        tokenNo: randomInt(100, 999),
        studentName: randomPick(studentNames),
        items,
        subtotal: total,
        taxAmount,
        serviceCharge,
        amount,
        status,
        paymentMode,
        priority: Math.random() > 0.75 ? ORDER_PRIORITY.HIGH : ORDER_PRIORITY.NORMAL,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        upiRef: paymentMode === "UPI" ? `UPI${randomInt(100000, 999999)}` : "N/A",
      });
    }
  });

  return orders.sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
}

async function mockResponse(payload, status = 200, _delay = 0) {
  if (status >= 400) {
    const error: any = new Error(payload?.message || "Request failed");
    error.status = status;
    throw error;
  }

  return payload;
}

function scopedOrders(tenantId) {
  if (!tenantId) return [...ordersDb];
  return ordersDb.filter((order) => order.tenantId === tenantId);
}

function scopedOutlets(tenantId) {
  if (!tenantId) return [...outletsDb];
  return outletsDb.filter((outlet) => outlet.tenantId === tenantId);
}

function scopedUsers(tenantId) {
  if (!tenantId) return [...usersDb];
  return usersDb.filter((user) => user.tenantId === tenantId);
}

function aggregateOutletMetrics(tenantId) {
  const outlets = scopedOutlets(tenantId);

  return outlets.map((outlet) => {
    const outletOrders = ordersDb.filter((order) => order.outletId === outlet.id);
    const grossRevenue = outletOrders.reduce((sum, order) => sum + order.amount, 0);
    const totalOrders = outletOrders.length;
    const activeOrders = outletOrders.filter((order) => order.status !== "Collected").length;
    const commissionAmount = Math.round((grossRevenue * outlet.commissionRate) / 100);

    return {
      ...outlet,
      grossRevenue,
      totalOrders,
      activeOrders,
      commissionAmount,
      aov: totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0,
    };
  });
}

function buildRevenueSeries(tenantId) {
  const now = new Date();
  const series = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * DAY_MS);
    const dayRevenue = scopedOrders(tenantId)
      .filter((order) => isSameDay(day, toDate(order.createdAt)))
      .reduce((sum, order) => sum + order.amount, 0);

    series.push({ label: dayLabel(day), revenue: dayRevenue });
  }

  return series;
}

function buildOrderDistribution(tenantId) {
  const relevant = scopedOrders(tenantId);
  return ORDER_STATUSES.map((status) => ({
    name: status,
    value: relevant.filter((order) => order.status === status).length,
  }));
}

function buildPeakHeatmap(tenantId) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = ["07-09", "09-11", "11-13", "13-15", "15-17", "17-19", "19-21"];

  const grid = days.map((day) => ({ day, slots: slots.map((slot) => ({ slot, value: 0 })) }));

  scopedOrders(tenantId).forEach((order) => {
    const dt = toDate(order.createdAt);
    const dayIndex = (dt.getDay() + 6) % 7;
    const hour = dt.getHours();
    let slotIndex = -1;

    if (hour >= 7 && hour < 9) slotIndex = 0;
    if (hour >= 9 && hour < 11) slotIndex = 1;
    if (hour >= 11 && hour < 13) slotIndex = 2;
    if (hour >= 13 && hour < 15) slotIndex = 3;
    if (hour >= 15 && hour < 17) slotIndex = 4;
    if (hour >= 17 && hour < 19) slotIndex = 5;
    if (hour >= 19 && hour < 21) slotIndex = 6;

    if (slotIndex >= 0) {
      grid[dayIndex].slots[slotIndex].value += 1;
    }
  });

  return grid;
}

function getPeriodRevenue(orders, days) {
  return orders
    .filter((order) => inLastDays(toDate(order.createdAt), days))
    .reduce((sum, order) => sum + order.amount, 0);
}

function getPeriodOrders(orders, days) {
  return orders.filter((order) => inLastDays(toDate(order.createdAt), days)).length;
}

function moveRandomOrders(tenantId) {
  const candidates = ordersDb.filter(
    (order) => order.tenantId === tenantId && ["Pending", "Preparing", "Ready"].includes(order.status),
  );

  const moveCount = randomInt(1, Math.min(3, candidates.length));

  for (let idx = 0; idx < moveCount; idx += 1) {
    const item = candidates[randomInt(0, candidates.length - 1)];
    const nextStatus = STATUS_SEQUENCE[item.status];
    if (!nextStatus) continue;
    item.status = nextStatus;
    item.updatedAt = new Date().toISOString();
  }
}

function maybeGenerateIncomingOrder(tenantId) {
  const chance = Math.random();
  if (chance < 0.45) {
    return { generated: false, order: null };
  }

  const tenantOutlets = scopedOutlets(tenantId).filter((item) => item.status === "Active");
  if (!tenantOutlets.length) {
    return { generated: false, order: null };
  }

  const outlet = randomPick(tenantOutlets);
  const { items, total } = buildItems();
  const taxAmount = Math.round(total * 0.05);
  const serviceCharge = Math.round(total * 0.02);
  const amount = total + taxAmount + serviceCharge;
  const paymentMode = randomPick(PAYMENT_MODES);

  const order = {
    id: nextId("order"),
    tenantId,
    outletId: outlet.id,
    outletName: outlet.name,
    vendorName: outlet.vendorName,
    tokenNo: randomInt(100, 999),
    studentName: randomPick(["Akhil", "Navya", "Sana", "Tarun", "Pallavi", "Rohit"]),
    items,
    subtotal: total,
    taxAmount,
    serviceCharge,
    amount,
    status: "Pending",
    paymentMode,
    priority: Math.random() > 0.7 ? ORDER_PRIORITY.HIGH : ORDER_PRIORITY.NORMAL,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    upiRef: paymentMode === "UPI" ? `UPI${randomInt(100000, 999999)}` : "N/A",
  };

  ordersDb.unshift(order);
  return { generated: true, order };
}

export async function login(payload) {
  const { email, password } = payload;
  const account = usersDb.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (!account || account.password !== password) {
    return mockResponse({ message: "Invalid credentials" }, 401, 300);
  }

  if (account.status !== "Active") {
    return mockResponse({ message: "Invalid credentials" }, 401, 280);
  }

  const tenants = getAccessibleTenants(account.tenantAccess);
  const selectedTenantId =
    account.tenantId ?? account.tenantAccess[0] ?? tenants[0]?.id ?? null;

  if (!selectedTenantId) {
    return mockResponse({ message: "No tenant access configured for this account" }, 403, 280);
  }
  const token = jwt.sign(
    {
      role: account.role,
      tenantId: account.tenantId,
      tenantAccess: account.tenantAccess,
      selectedTenantId,
    },
    ADMIN_JWT_SECRET,
    {
      subject: account.id,
      expiresIn: ADMIN_SESSION_TTL_SECONDS,
      issuer: ADMIN_JWT_ISSUER,
      audience: ADMIN_JWT_AUDIENCE,
    },
  );
  const sessionUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    tenantId: account.tenantId,
    tenantAccess: account.tenantAccess,
    selectedTenantId,
    assignedOutletIds: account.assignedOutletIds,
  };

  return mockResponse(
    {
      token,
      user: {
        ...sessionUser,
      },
      tenants,
    },
    200,
    320,
  );
}

export function getAdminSessionFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET, {
      issuer: ADMIN_JWT_ISSUER,
      audience: ADMIN_JWT_AUDIENCE,
    });
    return toAdminSessionFromJwt(token, decoded);
  } catch {
    return null;
  }
}

export async function getTenants(tenantAccess) {
  return mockResponse(getAccessibleTenants(tenantAccess), 200, 140);
}

export async function getExecutiveSnapshot(tenantId) {
  const tenantOrders = scopedOrders(tenantId);
  const today = tenantOrders.filter((order) => isSameDay(new Date(), toDate(order.createdAt)));

  const todayRevenue = today.reduce((sum, order) => sum + order.amount, 0);
  const weekRevenue = getPeriodRevenue(tenantOrders, 7);
  const monthRevenue = getPeriodRevenue(tenantOrders, 30);
  const totalOrders = getPeriodOrders(tenantOrders, 30);
  const aov = totalOrders > 0 ? Math.round(monthRevenue / totalOrders) : 0;
  const activeOrders = tenantOrders.filter((order) => order.status !== "Collected").length;

  return mockResponse(
    {
      totals: {
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalOrders,
        aov,
        activeOrders,
      },
      revenueSeries: buildRevenueSeries(tenantId),
      distribution: buildOrderDistribution(tenantId),
      outletPerformance: aggregateOutletMetrics(tenantId),
      heatmap: buildPeakHeatmap(tenantId),
    },
    200,
    240,
  );
}

export async function getOrders(tenantId) {
  const orders = scopedOrders(tenantId).sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime(),
  );
  return mockResponse(orders, 200, 180);
}

export async function refreshLiveOrders(tenantId) {
  moveRandomOrders(tenantId);
  const generated = maybeGenerateIncomingOrder(tenantId);

  const activeOrders = scopedOrders(tenantId)
    .filter((order) => order.status !== "Collected")
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());

  return mockResponse({ orders: activeOrders, generated }, 200, 220);
}

export async function updateOrderStatus(orderId, nextStatus, tenantId) {
  const target = ordersDb.find((order) => order.id === orderId);
  if (!target || (tenantId && target.tenantId !== tenantId)) {
    return mockResponse({ message: "Order not found" }, 404, 200);
  }

  if (!ORDER_STATUSES.includes(nextStatus)) {
    return mockResponse({ message: "Invalid order status" }, 400, 140);
  }

  target.status = nextStatus;
  target.updatedAt = new Date().toISOString();

  return mockResponse(target, 200, 120);
}

export async function getOrderById(orderId, tenantId) {
  const order = ordersDb.find((item) => item.id === orderId);
  if (!order || (tenantId && order.tenantId !== tenantId)) {
    return mockResponse({ message: "Order not found" }, 404, 120);
  }
  return mockResponse(order, 200, 90);
}

export async function getOutlets(tenantId) {
  return mockResponse(aggregateOutletMetrics(tenantId), 200, 180);
}

export async function createOutlet(payload) {
  const tenantId = normalizeText(payload.tenantId);
  const name = normalizeText(payload.name);
  const vendorName = normalizeText(payload.vendorName);
  const status = normalizeStatus(payload.status);
  const commissionRate = normalizeCommissionRate(payload.commissionRate);

  if (!tenantId || !isKnownTenant(tenantId)) {
    return mockResponse({ message: "Invalid tenant selected" }, 400, 150);
  }
  if (!name) {
    return mockResponse({ message: "Outlet name is required" }, 400, 150);
  }
  if (!vendorName) {
    return mockResponse({ message: "Vendor name is required" }, 400, 150);
  }

  const duplicate = outletsDb.find(
    (outlet) =>
      outlet.tenantId === tenantId &&
      outlet.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return mockResponse(
      { message: "An outlet with this name already exists for the selected tenant" },
      409,
      140,
    );
  }

  const newOutlet = {
    id: nextId("outlet"),
    tenantId,
    name,
    vendorName,
    commissionRate,
    status,
  };

  outletsDb.unshift(newOutlet);
  return mockResponse(newOutlet, 201, 170);
}

export async function updateOutlet(outletId, payload, tenantId) {
  const target = outletsDb.find((item) => item.id === outletId);
  if (!target || (tenantId && target.tenantId !== tenantId)) {
    return mockResponse({ message: "Outlet not found" }, 404, 160);
  }

  const name = normalizeText(payload.name || target.name);
  const vendorName = normalizeText(payload.vendorName || target.vendorName);
  const status = normalizeStatus(payload.status || target.status);
  const commissionRate = normalizeCommissionRate(payload.commissionRate ?? target.commissionRate);

  const duplicate = outletsDb.find(
    (outlet) =>
      outlet.id !== outletId &&
      outlet.tenantId === target.tenantId &&
      outlet.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return mockResponse(
      { message: "Another outlet with this name already exists for this tenant" },
      409,
      140,
    );
  }

  Object.assign(target, {
    name,
    vendorName,
    commissionRate,
    status,
  });

  return mockResponse(target, 200, 150);
}

export async function deleteOutlet(outletId, tenantId) {
  const target = outletsDb.find((item) => item.id === outletId);
  if (!target || (tenantId && target.tenantId !== tenantId)) {
    return mockResponse({ message: "Outlet not found" }, 404, 130);
  }

  outletsDb = outletsDb.filter((item) => item.id !== outletId);
  usersDb = usersDb.map((user) => ({
    ...user,
    assignedOutletIds: user.assignedOutletIds.filter((id) => id !== outletId),
  }));
  return mockResponse({ success: true }, 200, 130);
}

export async function getUsers(tenantId) {
  return mockResponse(scopedUsers(tenantId).map(toPublicUser), 200, 140);
}

export async function createUser(payload) {
  const tenantId = normalizeText(payload.tenantId);
  const name = normalizeText(payload.name);
  const email = normalizeEmail(payload.email);
  const role = normalizeText(payload.role);
  const status = normalizeStatus(payload.status);

  if (!tenantId || !isKnownTenant(tenantId)) {
    return mockResponse({ message: "Invalid tenant selected" }, 400, 140);
  }
  if (!name) {
    return mockResponse({ message: "User name is required" }, 400, 140);
  }
  if (!email) {
    return mockResponse({ message: "Email is required" }, 400, 140);
  }
  if (!Object.values(ROLES).includes(role)) {
    return mockResponse({ message: "Invalid user role" }, 400, 140);
  }

  const duplicateEmail = usersDb.find(
    (user) => user.email.toLowerCase() === email,
  );
  if (duplicateEmail) {
    return mockResponse({ message: "User email already exists" }, 409, 130);
  }

  const assignedOutletIds = sanitizeAssignedOutletIds(
    tenantId,
    payload.assignedOutletIds,
  );

  const user = {
    id: nextId("user"),
    tenantId,
    tenantAccess: ensureTenant(tenantId),
    name,
    email,
    password: "Secure@123",
    role,
    status,
    assignedOutletIds,
  };

  usersDb.unshift(user);
  return mockResponse(toPublicUser(user), 201, 180);
}

export async function updateUser(userId, payload, tenantId) {
  const target = usersDb.find((user) => user.id === userId);
  if (!target || (tenantId && target.tenantId !== tenantId)) {
    return mockResponse({ message: "User not found" }, 404, 130);
  }

  const name = normalizeText(payload.name || target.name);
  const email = normalizeEmail(payload.email || target.email);
  const role = normalizeText(payload.role || target.role);
  const status = normalizeStatus(payload.status || target.status);

  if (!name) {
    return mockResponse({ message: "User name is required" }, 400, 130);
  }
  if (!email) {
    return mockResponse({ message: "Email is required" }, 400, 130);
  }
  if (!Object.values(ROLES).includes(role)) {
    return mockResponse({ message: "Invalid user role" }, 400, 130);
  }

  const duplicateEmail = usersDb.find(
    (user) => user.id !== userId && user.email.toLowerCase() === email,
  );
  if (duplicateEmail) {
    return mockResponse({ message: "User email already exists" }, 409, 120);
  }

  const assignedOutletIds = sanitizeAssignedOutletIds(
    target.tenantId,
    payload.assignedOutletIds ?? target.assignedOutletIds,
  );

  Object.assign(target, {
    name,
    email,
    role,
    status,
    assignedOutletIds,
  });

  return mockResponse(toPublicUser(target), 200, 160);
}

export async function toggleUserStatus(userId, tenantId) {
  const target = usersDb.find((user) => user.id === userId);
  if (!target || (tenantId && target.tenantId !== tenantId)) {
    return mockResponse({ message: "User not found" }, 404, 130);
  }

  target.status = target.status === "Active" ? "Inactive" : "Active";
  return mockResponse(toPublicUser(target), 200, 140);
}

export async function getSettings(tenantId) {
  if (!tenantId || !settingsDb[tenantId]) {
    return mockResponse({ message: "Settings not found for tenant" }, 404, 120);
  }
  return mockResponse(settingsDb[tenantId], 200, 120);
}

export async function updateSettings(tenantId, payload) {
  if (!tenantId || !settingsDb[tenantId]) {
    return mockResponse({ message: "Settings not found for tenant" }, 404, 120);
  }

  settingsDb = {
    ...settingsDb,
    [tenantId]: {
      ...settingsDb[tenantId],
      ...payload,
    },
  };

  return mockResponse(settingsDb[tenantId], 200, 120);
}

function rangeDays(range) {
  if (range === "Today") return 1;
  if (range === "Week") return 7;
  return 30;
}

export async function getReportsSnapshot(tenantId, range = "Week") {
  const days = rangeDays(range);
  const orders = scopedOrders(tenantId);
  const current = orders.filter((order) => inLastDays(toDate(order.createdAt), days));
  const previous = orders.filter((order) => {
    const date = toDate(order.createdAt).getTime();
    const now = Date.now();
    return now - date > days * DAY_MS && now - date <= days * 2 * DAY_MS;
  });

  const revenueCurrent = current.reduce((sum, order) => sum + order.amount, 0);
  const revenuePrevious = previous.reduce((sum, order) => sum + order.amount, 0);
  const orderCurrent = current.length;
  const orderPrevious = previous.length;

  const revenueByOutlet = aggregateOutletMetrics(tenantId)
    .map((outlet) => ({
      outlet: outlet.name,
      revenue: current
        .filter((order) => order.outletId === outlet.id)
        .reduce((sum, order) => sum + order.amount, 0),
      orders: current.filter((order) => order.outletId === outlet.id).length,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const paymentMap = PAYMENT_MODES.map((mode) => ({
    mode,
    value: current.filter((order) => order.paymentMode === mode).length,
  }));

  const hourlyDemand = Array.from({ length: 8 }, (_, idx) => {
    const start = 8 + idx * 2;
    const end = start + 2;
    const label = `${start.toString().padStart(2, "0")}:00-${end.toString().padStart(2, "0")}:00`;

    return {
      slot: label,
      orders: current.filter((order) => {
        const hour = toDate(order.createdAt).getHours();
        return hour >= start && hour < end;
      }).length,
    };
  });

  const trend = {
    revenueGrowth:
      revenuePrevious === 0 ? 100 : ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100,
    orderGrowth: orderPrevious === 0 ? 100 : ((orderCurrent - orderPrevious) / orderPrevious) * 100,
  };

  return mockResponse(
    {
      range,
      revenueByOutlet,
      paymentMode: paymentMap,
      hourlyDemand,
      trend,
      periodTotals: {
        revenueCurrent,
        orderCurrent,
      },
    },
    200,
    190,
  );
}

export async function getEodRows(tenantId) {
  const rows = scopedOrders(tenantId)
    .filter((order) => isSameDay(new Date(), toDate(order.createdAt)))
    .map((order) => ({
      orderId: order.id,
      outlet: order.outletName,
      student: order.studentName,
      status: order.status,
      paymentMode: order.paymentMode,
      amount: order.amount,
      createdAt: order.createdAt,
    }));

  return mockResponse(rows, 200, 120);
}



