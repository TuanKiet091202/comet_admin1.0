import { NextRequest, NextResponse } from 'next/server';
import PayOS from '@/lib/payos';
import { connectToDB } from '@/lib/mongoDB';
import Customer from '@/lib/models/Customer';
import Order from '@/lib/models/Order';
import mongoose from 'mongoose';
import { cookies } from 'next/headers';

interface CartItem {
  item: {
    _id: string;
    title: string;
    price: number;
    size?: string;
  };
  quantity: number;
}

interface WebhookResponse {
  code: string;
  desc: string;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    paymentLinkId: string;
    status: string;
    buyerName: string;
    items?: {
      productId: string;
      size: string;
      name: string;
      quantity: number;
      price: number;
    }[];
  };
  signature: string;
}

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://comet-store.vercel.app';
console.log('Allowed Origin:', allowedOrigin);

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders, status: 204 });
}


// API POST: Tạo liên kết thanh toán và lưu vào DB
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json(); // Đọc và parse body

    console.log("Request Body:", payload);
    const DOMAIN = 'https://comet-store.vercel.app';

    // Lấy dữ liệu từ cookies
    const customerData = cookies().get('customer');
    const cartData = cookies().get('cartItems');
    const addressData = cookies().get('shippingAddress');

    console.log('Customer Data:', customerData);
    console.log('Cart Data:', cartData);
    console.log('Shipping Address Data:', addressData);

    if (!customerData || !cartData || !addressData) {
      return new NextResponse('Missing data in cookies', {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Chuyển đổi dữ liệu JSON từ cookies
    const customer = JSON.parse(customerData.value);
    const cartItems = JSON.parse(cartData.value);
    const shippingAddress = JSON.parse(addressData.value);

    console.log('Received cart items:', cartItems);
    console.log('Received customer:', customer);
    console.log('Received shipping address:', shippingAddress);

    // Tạo danh sách sản phẩm từ giỏ hàng
    const lineItems = cartItems.map((cartItem: CartItem) => ({
      name: cartItem.item.title,
      price: cartItem.item.price,
      quantity: cartItem.quantity,
      metadata: {
        productId: cartItem.item._id,
        size: cartItem.item.size || 'N/A',
      },
    }));

    // Tính tổng tiền
    const totalAmount = lineItems.reduce(
      (acc: number, item: any) => acc + item.price * item.quantity,
      0
    );

    // Tạo payload cho PayOS
    const body = {
      orderCode: Number(Date.now().toString().slice(-6)),
      amount: totalAmount,
      description: 'Thanh toán đơn hàng',
      items: lineItems,
      returnUrl: `${DOMAIN}/payment_success`,
      cancelUrl: `${DOMAIN}/cart`,
    };

    // Gọi API PayOS để tạo liên kết thanh toán
    const paymentLinkResponse = await PayOS.createPaymentLink(body);
    const { checkoutUrl, orderCode } = paymentLinkResponse;

    console.log('Payment Link:', checkoutUrl);

    // Lưu dữ liệu vào MongoDB
    await connectToDB();
    console.log('Connected to MongoDB.');

    // Tạo đơn hàng mới
    const newOrder = new Order({
      customerClerkId: customer.clerkId,
      products: cartItems.map((item: any) => ({
        product: new mongoose.Types.ObjectId(item.item._id),
        size: item.size || 'N/A',
        quantity: item.quantity,
      })),
      shippingAddress,
      totalAmount,
      orderCode,
    });

    await newOrder.save();
    console.log('Order saved to DB:', newOrder);

    // Tìm hoặc tạo khách hàng mới
    let existingCustomer = await Customer.findOne({ clerkId: customer.clerkId });

    if (existingCustomer) {
      existingCustomer.orders.push(newOrder._id);
    } else {
      existingCustomer = new Customer({
        clerkId: customer.clerkId,
        name: customer.name,
        email: customer.email,
        orders: [newOrder._id],
      });
    }

    await existingCustomer.save();
    console.log('Customer saved/updated in DB:', existingCustomer);

    // Trả về liên kết thanh toán và dữ liệu đơn hàng
    return NextResponse.json(
      { paymentLink: checkoutUrl, orderCode, cartItems, customer, shippingAddress },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[checkout_POST] Error:', error);
    return new NextResponse('Internal server error.', {
      status: 500,
      headers: corsHeaders,
    });
  }
}
