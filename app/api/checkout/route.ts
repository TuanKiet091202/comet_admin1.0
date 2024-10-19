import { NextRequest, NextResponse } from 'next/server';
import PayOS from '@/lib/payos';
import { connectToDB } from '@/lib/mongoDB';
import Customer from '@/lib/models/Customer';
import Order from '@/lib/models/Order';
import mongoose from 'mongoose';

interface CartItem {
  item: {
    _id: string;
    title: string;
    price: number;
    size?: string;
  };
  quantity: number;
}

// Xử lý request POST
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const DOMAIN = 'https://www.comet-store.vercel.app';

    const customerData = req.cookies.get('customer')?.value;
    const cartData = req.cookies.get('cartItems')?.value;
    const addressData = req.cookies.get('shippingAddress')?.value;

    if (!customerData || !cartData || !addressData) {
      return NextResponse.json({ error: 'Missing data in cookies' }, { status: 400 });
    }

    const customer = JSON.parse(customerData);
    const cartItems = JSON.parse(cartData);
    const shippingAddress = JSON.parse(addressData);

    const lineItems = cartItems.map((cartItem: CartItem) => ({
      name: cartItem.item.title,
      price: cartItem.item.price,
      quantity: cartItem.quantity,
      metadata: {
        productId: cartItem.item._id,
        size: cartItem.item.size || 'N/A',
      },
    }));

    const totalAmount = lineItems.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);

    const body = {
      orderCode: Number(Date.now().toString().slice(-6)),
      amount: totalAmount,
      description: 'Thanh toán đơn hàng',
      items: lineItems,
      returnUrl: `${DOMAIN}/payment_success`,
      cancelUrl: `${DOMAIN}/cart`,
    };

    const paymentLinkResponse = await PayOS.createPaymentLink(body);
    const { checkoutUrl, orderCode } = paymentLinkResponse;

    await connectToDB();

    const newOrder = new Order({
      customerClerkId: customer.clerkId,
      products: cartItems.map((item: any) => ({
        product: new mongoose.Types.ObjectId(item.item._id),
        size: item.item.size || 'N/A',
        quantity: item.quantity,
      })),
      shippingAddress,
      totalAmount,
      orderCode,
    });

    await newOrder.save();

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

    return NextResponse.json(
      { paymentLink: checkoutUrl, orderCode, cartItems, customer, shippingAddress },
      { status: 200 }
    );
  } catch (error) {
    console.error('[checkout_POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
