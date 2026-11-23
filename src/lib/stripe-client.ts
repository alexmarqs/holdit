import Stripe from "stripe";
import { env } from "@/env";

export const stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export type StripeEvent = Stripe.Event;
