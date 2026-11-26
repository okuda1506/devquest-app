// 課題の調査に使う場所を構成刷新後の採点版に固定する
const api = 'api/src/modules/';
const store = 'web/src/features/';
const admin = 'admin/src/features/';

const productCard = store + 'products/product-card.tsx';
const productList = store + 'products/product-list-page.tsx';
const productDetail = store + 'products/product-detail-page.tsx';
const productQuery = api + 'products/dto/product-query.dto.ts';
const productRepository = api + 'products/products.repository.ts';
const adminProducts = api + 'products/controllers/admin-products.controller.ts';
const inventory = api + 'inventory/inventory.service.ts';
const inventoryRepository = api + 'inventory/inventory.repository.ts';
const inventoryController = api + 'inventory/controllers/admin-inventory.controller.ts';
const manageInventory = admin + 'inventory/manage-inventory.tsx';
const checkout = api + 'checkout/checkout.service.ts';
const checkoutRepository = api + 'checkout/checkout.repository.ts';
const checkoutConfirm = store + 'checkout/checkout-confirm-page.tsx';
const orders = api + 'orders/orders.service.ts';
const ordersRepository = api + 'orders/orders.repository.ts';
const ordersController = api + 'orders/controllers/orders.controller.ts';
const adminOrders = api + 'orders/controllers/admin-orders.controller.ts';
const manageOrders = admin + 'orders/manage-orders.tsx';
const reports = api + 'reports/reports.service.ts';
const reportsRepository = api + 'reports/reports.repository.ts';

export const threadSourcePaths: Record<string, readonly string[]> = {
    'DEV-101': [productCard],
    'DEV-102': [store + 'products/product-sort.ts'],
    'DEV-103': [productList],
    'DEV-104': [productRepository, productQuery],
    'DEV-105': [inventoryController, inventory],
    'DEV-106': [productQuery, productRepository],
    'DEV-107': [store + 'cart/cart.tsx', api + 'cart/controllers/cart.controller.ts'],
    'DEV-108': [checkout, checkoutConfirm],
    'DEV-109': [ordersController, store + 'orders/orders.tsx'],
    'DEV-110': [api + 'products/products.module.ts', 'api/prisma/schema.prisma'],
    'DEV-111': [inventory, inventoryRepository],
    'DEV-112': [checkoutConfirm, checkout],
    'DEV-113': [productList],
    'DEV-114': [productList, productDetail],
    'DEV-115': [adminOrders, ordersRepository],
    'DEV-116': [adminProducts, productRepository],
    'DEV-117': [checkout, store + 'cart/cart.tsx'],
    'DEV-118': [manageOrders],
    'DEV-119': [inventory, inventoryRepository],
    'DEV-120': [ordersController, orders],
    'DEV-121': [productCard],
    'DEV-122': [productList, productQuery],
    'DEV-123': [productDetail],
    'DEV-124': [productDetail],
    'DEV-125': [productQuery, productRepository],
    'DEV-126': [productQuery, productRepository],
    'DEV-127': [adminOrders, ordersRepository],
    'DEV-128': [inventoryController, inventoryRepository],
    'DEV-129': [api + 'products/controllers/products.controller.ts', productRepository],
    'DEV-130': [adminOrders, orders],
    'DEV-131': [productList, productQuery],
    'DEV-132': [admin + 'dashboard/dashboard.tsx', inventoryController],
    'DEV-133': [productDetail],
    'DEV-134': [checkoutConfirm, checkout],
    'DEV-135': [ordersController, store + 'orders/orders.tsx'],
    'DEV-136': [adminOrders, manageOrders],
    'DEV-137': [orders, ordersRepository, checkoutRepository],
    'DEV-138': [adminOrders, manageOrders],
    'DEV-139': [inventoryController, manageInventory],
    'DEV-140': [adminProducts, productRepository],
    'DEV-141': [reports, reportsRepository],
    'DEV-142': [reportsRepository],
    'DEV-143': [reports, reportsRepository]
};
