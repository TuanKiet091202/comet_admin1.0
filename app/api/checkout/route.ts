import { NextApiRequest, NextApiResponse } from 'next';
import PayOS from '@/lib/payos';
import { connectToDB } from '@/lib/mongoDB';
import Customer from '@/lib/models/Customer';
import Order from '@/lib/models/Order';
import mongoose from 'mongoose';
import Cookies from 'js-cookie'; // Nếu bạn dùng cookies phía client.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Xử lý preflight OPTIONS request với CORS headers
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.comet-store.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { customer, cartItems, shippingAddress } = req.body;

    if (!customer || !cartItems || !shippingAddress) {
      return res.status(400).json({ error: 'Missing data in request body' });
    }

    const lineItems = cartItems.map((item: any) => ({
      name: item.title,
      price: item.price,
      quantity: item.quantity,
      metadata: {
        productId: item._id,
        size: item.size || 'N/A',
      },
    }));

    const totalAmount = lineItems.reduce(
      (acc: number, item: any) => acc + item.price * item.quantity,
      0
    );

    const DOMAIN = 'https://comet-store.vercel.app';

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
        product: new mongoose.Types.ObjectId(item._id),
        size: item.size || 'N/A',
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

    res.status(200).json({
      paymentLink: checkoutUrl,
      orderCode,
      cartItems,
      customer,
      shippingAddress,
    });
  } catch (error) {
    console.error('[checkout_POST] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
