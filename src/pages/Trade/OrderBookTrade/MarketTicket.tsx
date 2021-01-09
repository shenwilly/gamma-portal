import React, { useMemo, useState, useCallback, useEffect } from 'react'
import BigNumber from 'bignumber.js'
import { Button, TextInput, IconArrowRight, IconUnlock, Timer } from '@aragon/ui'
import { SubgraphOToken, SignedOrder, OTokenBalance } from '../../../types'

import { calculateOrderInput, calculateOrderOutput } from '../../../utils/0x-utils'
import { toTokenAmount, fromTokenAmount } from '../../../utils/math'

import { TradeAction, Errors, Spenders, getWeth, ZEROX_PROTOCOL_FEE_KEY, FeeTypes } from '../../../constants'
import { useConnectedWallet } from '../../../contexts/wallet'
import { getUSDC } from '../../../constants/addresses'

import oETHIcon from '../../../imgs/oETH.svg'
import USDCIcon from '../../../imgs/USDC.png'
import { useOrderbook } from '../../../contexts/orderbook'
import { use0xExchange } from '../../../hooks/use0xExchange'
import { useUserAllowance } from '../../../hooks/useAllowance'
import { simplifyOTokenSymbol } from '../../../utils/others'
import WarningText from '../../../components/Warning'
import LabelText from '../../../components/LabelText'
import TokenBalanceEntry from '../../../components/TokenBalanceEntry'
import { getPreference } from '../../../utils/storage'

enum Updates {
  Input,
  Output,
}

type MarketTicketProps = {
  action: TradeAction
  selectedOToken: SubgraphOToken
  oTokenBalances: OTokenBalance[] | null
  usdcBalance: BigNumber
  wethBalance: BigNumber
  inputTokenAmount: BigNumber
  setInputTokenAmount: React.Dispatch<React.SetStateAction<BigNumber>>
  outputTokenAmount: BigNumber
  setOutputTokenAmount: React.Dispatch<React.SetStateAction<BigNumber>>
}

export default function MarketTicket({
  action,
  selectedOToken,
  oTokenBalances,
  usdcBalance,
  wethBalance,
  inputTokenAmount,
  setInputTokenAmount,
  outputTokenAmount,
  setOutputTokenAmount,
}: MarketTicketProps) {
  const { networkId } = useConnectedWallet()

  const payFeeWithWeth = useMemo(() => getPreference(ZEROX_PROTOCOL_FEE_KEY, FeeTypes.ETH) === FeeTypes.WETH, [])
  const weth = useMemo(() => getWeth(networkId), [networkId])

  const paymentToken = useMemo(() => getUSDC(networkId), [networkId])

  const { fillOrders, getProtocolFee } = use0xExchange()

  // what was the last amount user adjust
  const [lastUpdate, setLastUpdate] = useState<Updates>(Updates.Input)

  const [error, setError] = useState(Errors.NO_ERROR)

  const [ordersToFill, setOrdersToFill] = useState<SignedOrder[]>([])
  const [amountsToFill, setAmountsToFill] = useState<BigNumber[]>([])

  const { orderbooks } = useOrderbook()

  const oTokenBalance = oTokenBalances?.find(b => b.token.id === selectedOToken.id)?.balance ?? new BigNumber(0)

  const { id, bids, asks } = useMemo(() => {
    const target = orderbooks.find(b => b.id === selectedOToken.id)
    return target ? target : { id: '', bids: [], asks: [] }
  }, [orderbooks, selectedOToken.id])

  const inputToken = useMemo(() => (action === TradeAction.Buy ? paymentToken : selectedOToken), [
    paymentToken,
    selectedOToken,
    action,
  ])

  const outputToken = useMemo(() => (action === TradeAction.Buy ? selectedOToken : paymentToken), [
    paymentToken,
    selectedOToken,
    action,
  ])

  const [needApprove, setNeedApprove] = useState(true)
  const { allowance: usdcAllowance, approve: approveUSDC } = useUserAllowance(paymentToken.id, Spenders.ZeroXERC20Proxy)
  const { allowance: oTokenAllowance, approve: approveOToken } = useUserAllowance(
    selectedOToken.id,
    Spenders.ZeroXERC20Proxy,
  )

  const approve = useCallback(() => {
    const rawInputAmount = fromTokenAmount(inputTokenAmount, inputToken.decimals)
    if (action === TradeAction.Buy) approveUSDC(rawInputAmount)
    else approveOToken(rawInputAmount)
  }, [inputTokenAmount, inputToken, action, approveUSDC, approveOToken])

  const inputIcon = useMemo(
    () => <img alt="inputtoken" width={25} src={action === TradeAction.Buy ? USDCIcon : oETHIcon} />,
    [action],
  )

  const outputIcon = useMemo(
    () => <img alt="outputtoken" width={25} src={action === TradeAction.Buy ? oETHIcon : USDCIcon} />,
    [action],
  )

  const protocolFee = useMemo(() => {
    return getProtocolFee(ordersToFill)
  }, [getProtocolFee, ordersToFill])

  const { allowance: wethAllowance, approve: approveWeth } = useUserAllowance(weth.id, Spenders.ZeroXStaking)
  const needApproveWeth = useMemo(() => payFeeWithWeth && toTokenAmount(wethAllowance, 18).lt(protocolFee), [
    protocolFee,
    wethAllowance,
    payFeeWithWeth,
  ])

  const hasEnoughWeth = useMemo(() => protocolFee.lte(toTokenAmount(wethBalance, 18)), [protocolFee, wethBalance])

  // when buy/sell is click, reset a few things
  useEffect(() => {
    setOrdersToFill([])
    setAmountsToFill([])
  }, [action])

  const handleInputChange = useCallback(
    event => {
      try {
        const newAmount = new BigNumber(event.target.value)
        setInputTokenAmount(newAmount)
        setLastUpdate(Updates.Input)
      } catch {}
    },
    [setInputTokenAmount],
  )

  const handleOuputChange = useCallback(
    event => {
      try {
        const newAmount = new BigNumber(event.target.value)
        setOutputTokenAmount(newAmount)
        setLastUpdate(Updates.Output)
      } catch {}
    },
    [setOutputTokenAmount],
  )

  // update numbers accordingly when 1. orderbook change, 2. user update either intput or output
  useEffect(() => {
    if (id === '') return
    if (lastUpdate !== Updates.Input) return
    // fix input, recalculate output
    const orders = action === TradeAction.Buy ? asks : bids
    const rawInputAmount = fromTokenAmount(inputTokenAmount, inputToken.decimals).integerValue()
    const { error, ordersToFill, amounts, sumOutput: rawOutput } = calculateOrderOutput(orders, rawInputAmount)
    const outputTokenAmount = toTokenAmount(rawOutput, outputToken.decimals)
    setOutputTokenAmount(outputTokenAmount)
    setError(error)
    setAmountsToFill(amounts)
    setOrdersToFill(ordersToFill)
  }, [asks, bids, inputTokenAmount, inputToken, outputToken, action, lastUpdate, id, setOutputTokenAmount])

  // triggered when output token amount is updaed
  useEffect(() => {
    if (id === '') return
    if (lastUpdate !== Updates.Output) return
    const orders = action === TradeAction.Buy ? asks : bids
    const rawOutputAmount = fromTokenAmount(outputTokenAmount, outputToken.decimals).integerValue()

    const { error, ordersToFill, amounts, sumInput: rawInput } = calculateOrderInput(orders, rawOutputAmount)
    const inputTokenAmount = toTokenAmount(rawInput, inputToken.decimals)
    setInputTokenAmount(inputTokenAmount)
    setError(error)
    setAmountsToFill(amounts)
    setOrdersToFill(ordersToFill)
  }, [
    id,
    action,
    inputToken.decimals,
    lastUpdate,
    asks,
    bids,
    outputToken.decimals,
    outputTokenAmount,
    setInputTokenAmount,
  ])

  useEffect(() => {
    if (error !== Errors.NO_ERROR) return
    const inputBalance = action === TradeAction.Buy ? usdcBalance : oTokenBalance
    const rawInputAmount = fromTokenAmount(inputTokenAmount, inputToken.decimals).integerValue()
    if (rawInputAmount.gt(inputBalance)) setError(Errors.INSUFFICIENT_BALANCE)
  }, [usdcBalance, oTokenBalance, inputToken, inputTokenAmount, action, error])

  const fill = useCallback(async () => {
    await fillOrders(ordersToFill, amountsToFill)
  }, [fillOrders, ordersToFill, amountsToFill])

  // check has enough input
  useEffect(() => {
    const inputRawAmount = fromTokenAmount(inputTokenAmount, inputToken.decimals)
    if (action === TradeAction.Buy) {
      setNeedApprove(usdcAllowance.lt(inputRawAmount))
    } else {
      setNeedApprove(oTokenAllowance.lt(inputRawAmount))
    }
  }, [action, oTokenAllowance, usdcAllowance, inputTokenAmount, inputToken])

  const closestExpry = useMemo(() => {
    return ordersToFill.length > 0 ? Math.min(...ordersToFill.map(o => Number(o.expirationTimeSeconds))) : 0
  }, [ordersToFill])

  return (
    <>
      <div style={{ display: 'flex' }}>
        <div>
          <TextInput
            type="number"
            adornment={inputIcon}
            adornmentPosition="end"
            value={inputTokenAmount.toNumber()}
            onChange={handleInputChange}
          />
          <WarningText show={error !== Errors.NO_ERROR} text={error} />
        </div>
        <div style={{ padding: '5px' }}>
          <IconArrowRight size="medium" />
        </div>
        <div>
          <TextInput
            type="number"
            adornment={outputIcon}
            adornmentPosition="end"
            value={outputTokenAmount.toFixed()}
            onChange={handleOuputChange}
          />
        </div>
      </div>
      <br />
      <TokenBalanceEntry
        label="Protocol Fee"
        amount={protocolFee.toString()}
        symbol={payFeeWithWeth ? 'WETH' : 'ETH'}
      />
      <WarningText show={payFeeWithWeth && !hasEnoughWeth} text="Insufficient WETH balance" />
      <br />
      <TokenBalanceEntry
        label="oToken Balance"
        amount={toTokenAmount(oTokenBalance, 8).toString()}
        symbol={simplifyOTokenSymbol(selectedOToken.symbol)}
      />
      <TokenBalanceEntry
        label="USDC Balance"
        amount={toTokenAmount(usdcBalance, paymentToken.decimals).toString()}
        symbol={paymentToken.symbol}
      />
      <br />

      <div style={{ display: 'flex', paddingTop: '5px' }}>
        <LabelText label={'Expires in'} minWidth={'150px'} />
        <Timer end={new Date(closestExpry * 1000)} />
      </div>

      <div style={{ display: 'flex', paddingTop: '20px' }}>
        <Button
          disabled={
            (payFeeWithWeth && (!hasEnoughWeth || needApproveWeth)) ||
            needApprove ||
            error !== Errors.NO_ERROR ||
            inputTokenAmount.isZero() ||
            inputTokenAmount.isNaN()
          }
          label={action === TradeAction.Buy ? 'Confirm Buy' : 'Confirm Sell'}
          mode={action === TradeAction.Buy ? 'positive' : 'negative'}
          onClick={fill}
        />
        {needApprove && <Button label="approve" icon={<IconUnlock />} display="icon" onClick={approve} />}
        {needApproveWeth && <Button label="approve" icon={<IconUnlock />} display="icon" onClick={approveWeth} />}
      </div>
    </>
  )
}