import * as React from 'react'
import { Dispatcher } from '../../lib/dispatcher'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { ButtonGroup } from '../lib/button-group'
import { Button } from '../lib/button'
import { Checkout } from './stripe-checkout'
import { Account } from '../../models/account'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { fetchCoupon, IAPICoupon } from '../../lib/api'
import { CouponInput } from './coupon-input'

interface IPremiumUpsellProps {
  /** A function called when the dialog is dismissed. */
  readonly onDismissed: () => void
  readonly dispatcher: Dispatcher
  readonly user: Account
  readonly isUnlockingKactusFullAccess: boolean
  readonly enterprise: boolean
}

interface IPremiumUpsellState {
  /** A function called when the dialog is dismissed. */
  readonly showingCheckout: boolean
  readonly loadingCheckout: boolean
  readonly coupon: string
  readonly plan: string
  readonly couponState: IAPICoupon | 'loading' | null
}

export class PremiumUpsell extends React.Component<
  IPremiumUpsellProps,
  IPremiumUpsellState
> {

  private scheduler = new ThrottledScheduler(200)

  private requestId = 0

  public constructor(props: IPremiumUpsellProps) {
    super(props)
    this.state = {
      showingCheckout: false,
      loadingCheckout: false,
      coupon: '',
      plan: 'kactus-1-month',
      couponState: null
    }
  }

  public componentWillUpdate(nextProps: IPremiumUpsellProps) {
    if (
      !nextProps.isUnlockingKactusFullAccess &&
      this.props.isUnlockingKactusFullAccess
    ) {
      setTimeout(() => this.props.onDismissed(), 1000)
    }
  }

  public componentWillUnmount() {
    this.scheduler.clear()
  }

  private showCheckout = () => {
    this.setState({
      loadingCheckout: true,
    })
  }

  private finishedLoadingCheckout = () => {
    this.setState({
      showingCheckout: true,
      loadingCheckout: false,
    })
  }

  private onToken = (token: IToken) => {
    this.props.dispatcher.unlockKactus(this.props.user, token.id, {
      email: token.email,
      enterprise: this.props.enterprise,
      coupon: this.state.coupon !== '' ? this.state.coupon : undefined
    })
  }

  private onCouponChange = (coupon: string) => {
    if (coupon === '') {
      this.scheduler.clear()
      return this.setState({
        coupon,
        couponState: null
      })
    }

    this.setState({
      coupon,
      couponState: 'loading'
    })

    this.scheduler.queue(async () => {
      this.requestId += 1
      const couponState = await fetchCoupon(coupon, this.requestId)
      if (couponState.requestId !== this.requestId) { return }
      this.setState({
        couponState
      })
    })
  }

  public render() {
    const { loadingCheckout, showingCheckout, couponState, coupon } = this.state

    if (this.props.isUnlockingKactusFullAccess) {
      return (
        <Dialog
          id="premium-upsell"
          title="Unlocking the full potential of Kactus"
          onDismissed={this.props.onDismissed}
          loading={true}
        >
          <DialogContent>Hang on, unlocking your account...</DialogContent>
        </Dialog>
      )
    }

    if (this.props.user.unlockedKactus) {
      return (
        <Dialog
          id="premium-upsell"
          title="Full potential of Kactus unlocked!"
          onDismissed={this.props.onDismissed}
        >
          <DialogContent>Done, thank! Enjoy Kactus!</DialogContent>
        </Dialog>
      )
    }

    const copy = this.props.enterprise
      ? ``
      : (
        <div>
          <p>Hey! This feature is only available in the full access version of Kactus.</p>
          <ul>
            <li>feature 1</li>
            <li>feature 2</li>
          </ul>
          <CouponInput couponState={couponState} coupon={coupon} onValueChanged={this.onCouponChange} />
        </div>
      )

    return (
      <div>
        {(loadingCheckout || showingCheckout) &&
          <Checkout
            onDismissed={this.props.onDismissed}
            onLoaded={this.finishedLoadingCheckout}
            onToken={this.onToken}
            user={this.props.user}
            enterprise={this.props.enterprise}
          />}
        {!showingCheckout &&
          <Dialog
            id="premium-upsell"
            title="Unlock the full potential of Kactus"
            onSubmit={this.showCheckout}
            onDismissed={this.props.onDismissed}
            loading={loadingCheckout}
          >
            <DialogContent>{copy}</DialogContent>

            <DialogFooter>
              <ButtonGroup>
                <Button type="submit" disabled={couponState !== 'loading' && (couponState === null || !!couponState.discount)}>Unlock Kactus</Button>
                <Button onClick={this.props.onDismissed}>Not now</Button>
              </ButtonGroup>
            </DialogFooter>
          </Dialog>}
      </div>
    )
  }
}
