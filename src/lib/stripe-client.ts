import Stripe from "stripe";
import { serverEnv } from "./utils/env";

export const stripeClient = serverEnv.stripeSecretKey
  ? new Stripe(serverEnv.stripeSecretKey)
  : null;

export type StripeEvent = Stripe.Event;
